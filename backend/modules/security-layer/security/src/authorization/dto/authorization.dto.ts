import { z } from 'zod';

const subjectType = z.enum(['user', 'agent']);
const accessEffect = z.enum(['allow', 'deny']);
const rowFilterSchema = z
  .record(
    z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
  )
  .refine((filter) => !Object.hasOwn(filter, 'tenantId'), 'tenantId is always enforced by the PEP');

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

export const authorizationObligationsSchema = z.object({
  audit: z.boolean().optional(),
  maskColumns: z.array(z.string().min(1)).optional(),
  rowFilter: rowFilterSchema.optional(),
  requireMfa: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
  maxRows: z.number().int().positive().optional(),
});

export const grantTenantPermissionSchema = z.object({
  permissionId: z.string().min(1),
  obligations: authorizationObligationsSchema.optional(),
});
export type GrantTenantPermissionDto = z.infer<typeof grantTenantPermissionSchema>;

export const addParentRoleSchema = z.object({ parentRoleId: z.string().min(1) });
export type AddParentRoleDto = z.infer<typeof addParentRoleSchema>;

export const createRoleAssignmentSchema = z.object({
  subjectId: z.string().min(1),
  subjectType,
  tenantId: z.string().min(1),
  roleId: z.string().min(1),
});
export type CreateRoleAssignmentDto = z.infer<typeof createRoleAssignmentSchema>;

export const createObjectPermissionSchema = z.object({
  subjectId: z.string().min(1),
  subjectType,
  tenantId: z.string().min(1),
  resourceKey: z.string().min(1),
  permissionKey: z.string().min(1),
  objectId: z.string().min(1),
  effect: accessEffect,
});
export type CreateObjectPermissionDto = z.infer<typeof createObjectPermissionSchema>;

export const authorizeSchema = z.object({
  action: z.string().min(1),
  resource: z.object({
    type: z.string().min(1),
    id: z.string().min(1).optional(),
    attributes: z.record(z.string(), z.unknown()).default({}),
  }),
  context: z.object({
    requestId: z.string().min(1).optional(),
    environment: z.string().min(1).optional(),
    ipAddress: z.string().min(1).optional(),
    userAgent: z.string().min(1).optional(),
    mfaVerified: z.boolean().optional(),
    additionalAttributes: z.record(z.string(), z.unknown()).optional(),
  }).default({}),
});
export type AuthorizeDto = z.infer<typeof authorizeSchema>;
