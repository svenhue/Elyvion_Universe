import { z } from 'zod';

export const registerUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  name: z.string().min(1).optional(),
});

export const verifyCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
});

export const bootstrapTenantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  adminEmail: z.string().email(),
});

export const tenantMemberSchema = z.object({
  email: z.string().email(),
});

export type RegisterUserDto = z.infer<typeof registerUserSchema>;
export type VerifyCredentialsDto = z.infer<typeof verifyCredentialsSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
