import { z } from "zod";
import { ROLES } from "@/lib/constants";

export const loginIdSchema = z
  .string({ error: "Enter a login ID" })
  .trim()
  .toLowerCase()
  .min(6, "Login ID must be 6-12 characters")
  .max(12, "Login ID must be 6-12 characters")
  .regex(/^[a-z0-9._-]+$/, "Use letters, numbers, dot, underscore or hyphen only");

export const emailSchema = z
  .string({ error: "Enter your email" })
  .trim()
  .toLowerCase()
  .min(1, "Enter your email")
  .max(120, "Email is too long")
  .pipe(z.email("Enter a valid email address"));

/** Mockup rule: lower case, upper case and a special character, more than 8 characters. */
export const passwordSchema = z
  .string({ error: "Enter a password" })
  .min(9, "Password must be more than 8 characters")
  .max(64, "Password must be at most 64 characters")
  .regex(/[a-z]/, "Include at least one lowercase letter")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[^A-Za-z0-9]/, "Include at least one special character");

export const PASSWORD_RULES = [
  { label: "More than 8 characters", test: (value: string) => value.length > 8 },
  { label: "A lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "An uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "A special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

const nameSchema = z
  .string({ error: "Enter your name" })
  .trim()
  .min(2, "Enter your full name")
  .max(60, "Name must be at most 60 characters");

export const signupSchema = z
  .object({
    name: nameSchema,
    loginId: loginIdSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Re-enter your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, "Enter your login ID or email"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const otpSchema = z
  .string({ error: "Enter the 6-digit code" })
  .regex(/^\d{6}$/, "Enter the 6-digit code");

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    otp: otpSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Re-enter your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const profileSchema = z.object({ name: nameSchema, email: emailSchema });
export type ProfileInput = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Re-enter the new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    error: "Choose a password different from the current one",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** A manager creating an account for a colleague (with a temporary password). */
export const userCreateSchema = z.object({
  name: nameSchema,
  loginId: loginIdSchema,
  email: emailSchema,
  role: z.enum(ROLES, { error: "Select a role" }),
  password: passwordSchema,
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z
  .object({
    role: z.enum(ROLES, { error: "Select a role" }).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.role !== undefined || data.isActive !== undefined, {
    error: "Nothing to update",
  });
