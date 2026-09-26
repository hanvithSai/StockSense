import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { isValidObjectId } from "mongoose";
import type { Role } from "@/lib/constants";
import type { SessionUser, UserDTO, UserOptionDTO } from "@/lib/types";
import type {
  ChangePasswordInput,
  LoginInput,
  ProfileInput,
  ResetPasswordInput,
  SignupInput,
} from "@/lib/validation/auth";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { AppError, badRequest, conflict, notFound, tooManyRequests, validationError } from "@/server/errors";
import { isMailConfigured, otpEmail, sendMail } from "@/server/mailer";
import { OtpToken } from "@/server/models/otp-token";
import { User, type UserRecord } from "@/server/models/user";

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 60;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 5;

type UserWithHash = UserRecord & { passwordHash: string };

/* ------------------------------------------------------------ registration */

export async function signup(input: SignupInput): Promise<UserRecord> {
  const [loginTaken, emailTaken] = await Promise.all([
    User.exists({ loginId: input.loginId }),
    User.exists({ email: input.email }),
  ]);
  const errors: Record<string, string> = {};
  if (loginTaken) errors.loginId = "This login ID is already taken";
  if (emailTaken) errors.email = "An account with this email already exists";
  if (Object.keys(errors).length) throw validationError(errors);

  // The first account bootstraps the workspace as a manager; later sign-ups join as staff.
  const role: Role = (await User.countDocuments()) === 0 ? "manager" : "staff";
  const user = await User.create({
    name: input.name,
    loginId: input.loginId,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role,
    lastLoginAt: new Date(),
  });
  return user.toObject() as UserRecord;
}

export async function login(input: LoginInput): Promise<UserRecord> {
  const user = await User.findOne({ $or: [{ loginId: input.identifier }, { email: input.identifier }] })
    .select("+passwordHash")
    .lean<UserWithHash>();

  if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new AppError(429, "ACCOUNT_LOCKED", `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}`);
  }

  const valid = await verifyPassword(input.password, user?.passwordHash);
  if (!user || !valid) {
    if (user) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1;
      await User.updateOne(
        { _id: user._id },
        attempts >= LOGIN_MAX_ATTEMPTS
          ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000) }
          : { failedLoginAttempts: attempts },
      );
    }
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Login Id or Password");
  }
  if (!user.isActive) throw new AppError(403, "ACCOUNT_DISABLED", "This account has been deactivated. Contact your manager");
  await User.updateOne({ _id: user._id }, { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null });
  return user;
}

/* ---------------------------------------------------------- password reset */

function hashCode(userId: string, code: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "").update(`${userId}:${code}`).digest("hex");
}

/**
 * Sends a 6-digit OTP to the account email. The response is identical whether or not the
 * email exists, so accounts cannot be enumerated.
 */
export async function requestPasswordReset(email: string): Promise<{ message: string; devCode?: string }> {
  const message = "If an account exists for this email, a 6-digit code has been sent.";
  const user = await User.findOne({ email, isActive: true }).lean<UserRecord>();
  if (!user) return { message };

  const recent = await OtpToken.findOne({ user: user._id, consumedAt: null }).sort({ createdAt: -1 }).lean();
  const recentCreatedAt = recent ? (recent as { createdAt?: Date }).createdAt : undefined;
  if (recentCreatedAt && Date.now() - recentCreatedAt.getTime() < OTP_RESEND_SECONDS * 1000) {
    const wait = Math.ceil(OTP_RESEND_SECONDS - (Date.now() - recentCreatedAt.getTime()) / 1000);
    throw tooManyRequests(`Please wait ${wait}s before requesting another code`);
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await OtpToken.deleteMany({ user: user._id });
  await OtpToken.create({
    user: user._id,
    codeHash: hashCode(user._id.toString(), code),
    expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
  });

  if (isMailConfigured()) {
    try {
      await sendMail({ to: user.email, ...otpEmail(user.name, code, OTP_TTL_MINUTES) });
    } catch (error) {
      console.error("[auth] failed to send OTP email", error);
      throw new AppError(502, "MAIL_FAILED", "We could not send the email right now. Please try again");
    }
    return { message };
  }

  // No SMTP configured (local/offline mode): the code is logged, and optionally echoed for demos.
  console.info(`[auth] password reset code for ${user.email}: ${code}`);
  return process.env.OTP_DEV_ECHO === "true" ? { message, devCode: code } : { message };
}

export async function resetPassword(input: ResetPasswordInput): Promise<UserRecord> {
  const invalid = () => badRequest("This code is invalid or has expired. Request a new one", { otp: "Invalid or expired code" });
  const user = await User.findOne({ email: input.email, isActive: true });
  if (!user) throw invalid();

  const token = await OtpToken.findOne({
    user: user._id,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
  if (!token) throw invalid();
  if (token.attempts >= OTP_MAX_ATTEMPTS) {
    throw tooManyRequests("Too many incorrect attempts. Request a new code");
  }

  const expected = Buffer.from(token.codeHash, "hex");
  const actual = Buffer.from(hashCode(user._id.toString(), input.otp), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    token.attempts += 1;
    await token.save();
    const left = OTP_MAX_ATTEMPTS - token.attempts;
    throw badRequest(left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left` : "Too many incorrect attempts. Request a new code", {
      otp: "Incorrect code",
    });
  }

  user.passwordHash = await hashPassword(input.password);
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  user.lastLoginAt = new Date();
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();
  await OtpToken.deleteMany({ user: user._id });
  return user.toObject() as UserRecord;
}

/* ----------------------------------------------------------------- profile */

export async function updateProfile(actor: SessionUser, input: ProfileInput): Promise<void> {
  if (await User.exists({ email: input.email, _id: { $ne: actor.id } })) {
    throw validationError({ email: "An account with this email already exists" });
  }
  await User.updateOne({ _id: actor.id }, { name: input.name, email: input.email });
}

export async function changePassword(actor: SessionUser, input: ChangePasswordInput): Promise<UserRecord> {
  const user = await User.findById(actor.id).select("+passwordHash");
  if (!user) throw notFound("User");
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw validationError({ currentPassword: "Current password is incorrect" });
  }
  user.passwordHash = await hashPassword(input.newPassword);
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  await user.save();
  return user.toObject() as UserRecord;
}

/* ------------------------------------------------------------------- users */

function toUserDTO(user: UserRecord & { createdAt?: Date }): UserDTO {
  return {
    id: user._id.toString(),
    loginId: user.loginId,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: (user.createdAt ?? new Date()).toISOString(),
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
  };
}

export async function listUsers(): Promise<UserDTO[]> {
  const users = await User.find().sort({ name: 1 }).lean<(UserRecord & { createdAt: Date })[]>();
  return users.map(toUserDTO);
}

export async function listUserOptions(): Promise<UserOptionDTO[]> {
  const users = await User.find({ isActive: true }).sort({ name: 1 }).select("name").lean<UserRecord[]>();
  return users.map((user) => ({ id: user._id.toString(), name: user.name }));
}

export async function updateUser(
  actor: SessionUser,
  id: string,
  input: { role?: Role; isActive?: boolean },
): Promise<void> {
  if (id === actor.id) throw conflict("You cannot change your own role or status");
  const user = isValidObjectId(id) ? await User.findById(id) : null;
  if (!user) throw notFound("User");

  const losesManager = user.role === "manager" && (input.role === "staff" || input.isActive === false);
  if (losesManager && (await User.countDocuments({ role: "manager", isActive: true })) <= 1) {
    throw conflict("At least one active manager is required");
  }
  if (input.role) user.role = input.role;
  if (input.isActive !== undefined) {
    user.isActive = input.isActive;
    if (!input.isActive) user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  }
  await user.save();
}
