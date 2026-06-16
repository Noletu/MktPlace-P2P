-- AlterTable: converte twoFactorBackupCodes de TEXT para JSONB preservando dados existentes.
-- (Prisma gera DROP COLUMN + ADD COLUMN, destrutivo; substituido por ALTER ... USING in-place.)
ALTER TABLE "User"
  ALTER COLUMN "twoFactorBackupCodes" TYPE JSONB
  USING (
    CASE
      WHEN "twoFactorBackupCodes" IS NULL OR "twoFactorBackupCodes" = '' THEN NULL
      ELSE "twoFactorBackupCodes"::jsonb
    END
  );
