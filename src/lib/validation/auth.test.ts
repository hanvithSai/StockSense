import { describe, expect, it } from "vitest";
import { loginIdSchema, passwordSchema, signupSchema } from "./auth";

describe("loginIdSchema", () => {
  it("accepts 6-12 characters and normalises case", () => {
    expect(loginIdSchema.parse("  Priya.S  ")).toBe("priya.s");
  });

  it.each(["abc", "averyverylongid", "bad id!"])("rejects %s", (value) => {
    expect(loginIdSchema.safeParse(value).success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepts lower + upper + special with more than 8 characters", () => {
    expect(passwordSchema.safeParse("Manager@123").success).toBe(true);
  });

  it.each([
    ["Short@1", "Password must be more than 8 characters"],
    ["NOLOWER@123", "Include at least one lowercase letter"],
    ["noupper@123", "Include at least one uppercase letter"],
    ["NoSpecial123", "Include at least one special character"],
  ])("rejects %s", (value, message) => {
    const result = passwordSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(message);
  });
});

describe("signupSchema", () => {
  const valid = {
    name: "Priya Sharma",
    loginId: "priya.s",
    email: " Priya@Company.com ",
    password: "Strong@Pass1",
    confirmPassword: "Strong@Pass1",
  };

  it("normalises the email", () => {
    expect(signupSchema.parse(valid).email).toBe("priya@company.com");
  });

  it("requires matching passwords", () => {
    const result = signupSchema.safeParse({ ...valid, confirmPassword: "Different@1" });
    expect(result.error?.issues[0]).toMatchObject({ path: ["confirmPassword"], message: "Passwords do not match" });
  });
});
