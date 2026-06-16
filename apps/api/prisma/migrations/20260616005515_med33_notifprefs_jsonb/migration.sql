-- AlterTable: converte notificationPreferences de TEXT para JSONB preservando dados existentes.
-- (Prisma gera DROP COLUMN + ADD COLUMN, destrutivo; substituido por ALTER ... USING in-place.)
ALTER TABLE "User"
  ALTER COLUMN "notificationPreferences" TYPE JSONB
  USING (
    CASE
      WHEN "notificationPreferences" IS NULL OR "notificationPreferences" = '' THEN NULL
      ELSE "notificationPreferences"::jsonb
    END
  );
