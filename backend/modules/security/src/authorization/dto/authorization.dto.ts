import { z } from 'zod';

const subjectType = z.enum(['user', 'agent']);
const accessEffect = z.enum(['allow', 'deny']);

export const registerResourceSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});
export type RegisterResourceDto = z.infer<typeof registerResourceSchema>;

export const registerPermissionSchema = z.object({
  resourceKey: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});
export type RegisterPermissionDto = z.infer<typeof registerPermissionSchema>;

export const createRoleSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});
export type CreateRoleDto = z.infer<typeof createRoleSchema>;

export const grantPermissionSchema = z.object({ permissionId: z.string().min(1) });
export type GrantPermissionDto = z.infer<typeof grantPermissionSchema>;

export const addParentRoleSchema = z.object({ parentRoleId: z.string().min(1) });
export type AddParentRoleDto = z.infer<typeof addParentRoleSchema>;

export const createRoleAssignmentSchema = z.object({
  subjectId: z.string().min(1),
  subjectType,
  roleId: z.string().min(1),
});
export type CreateRoleAssignmentDto = z.infer<typeof createRoleAssignmentSchema>;

export const createObjectPermissionSchema = z.object({
  subjectId: z.string().min(1),
  subjectType,
  resourceKey: z.string().min(1),
  permissionKey: z.string().min(1),
  objectId: z.string().min(1),
  effect: accessEffect,
});
export type CreateObjectPermissionDto = z.infer<typeof createObjectPermissionSchema>;

export const authorizeSchema = z.object({
  subjectId: z.string().min(1).optional(),
  subjectType: subjectType.optional(),
  resourceKey: z.string().min(1),
  permissionKey: z.string().min(1),
  objectId: z.string().min(1).optional(),
});
export type AuthorizeDto = z.infer<typeof authorizeSchema>;
