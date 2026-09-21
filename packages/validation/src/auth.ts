import { z } from 'zod';

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .min(3)
  .max(255)
  .toLowerCase()
  .trim();

export const passwordSchema = z
  .string()
  .regex(/^\d{4}$/, 'Password must be exactly 4 digits');

export const displayNameSchema = z
  .string()
  .min(2, 'Display name must be at least 2 characters')
  .max(100, 'Display name must be at most 100 characters')
  .trim();

export const requestOtpSchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema,
});

export const registerSchema = z.object({
  email: emailSchema,
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  password: passwordSchema,
  displayName: displayNameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
