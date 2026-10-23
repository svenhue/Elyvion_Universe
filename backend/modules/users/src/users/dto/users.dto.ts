import { z } from 'zod';

export const registerUserSchema = z.object({
  email: z.string().email(),
  // Loose dev-friendly floor so the skeleton's own quick local testing
  // (e.g. a plain "admin" password) isn't blocked — raise this (and add
  // complexity rules) before any real deployment.
  password: z.string().min(4),
  name: z.string().min(1).optional(),
});
export type RegisterUserDto = z.infer<typeof registerUserSchema>;

export const verifyCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type VerifyCredentialsDto = z.infer<typeof verifyCredentialsSchema>;
