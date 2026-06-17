-- AlterTable: converte AuditLog.metadata de TEXT para JSONB preservando dados existentes (in-place).
-- String JSON valida -> objeto jsonb; NULL ou '' -> NULL.
ALTER TABLE "AuditLog"
  ALTER COLUMN "metadata" TYPE JSONB
  USING (CASE WHEN "metadata" IS NULL OR "metadata" = '' THEN NULL ELSE "metadata"::jsonb END);
