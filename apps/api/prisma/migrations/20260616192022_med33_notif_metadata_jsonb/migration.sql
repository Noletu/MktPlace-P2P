-- AlterTable: converte Notification.metadata de TEXT para JSONB preservando dados existentes.
-- (Prisma gera DROP COLUMN + ADD COLUMN, destrutivo; substituido por ALTER ... USING in-place.)
ALTER TABLE "Notification"
  ALTER COLUMN "metadata" TYPE JSONB
  USING (
    CASE
      WHEN "metadata" IS NULL OR "metadata" = '' THEN NULL
      ELSE "metadata"::jsonb
    END
  );
