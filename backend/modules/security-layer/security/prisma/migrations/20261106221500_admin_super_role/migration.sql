ALTER TABLE "Role"
ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Role"
SET
    "isSuperAdmin" = true,
    "description" = 'Platform administrator with all registered permissions within active tenant memberships.'
WHERE "key" = 'admin';
