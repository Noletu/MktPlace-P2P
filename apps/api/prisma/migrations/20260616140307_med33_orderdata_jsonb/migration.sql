-- AlterTable: converte orderData de TEXT para JSONB preservando dados existentes.
-- Coluna e NOT NULL; o ADD ... NOT NULL gerado pelo Prisma falharia com rows.
-- ALTER ... USING converte in-place; fallback '{}' cobre vazio/null sem violar NOT NULL.
ALTER TABLE "Order"
  ALTER COLUMN "orderData" TYPE JSONB
  USING (
    CASE
      WHEN "orderData" IS NULL OR "orderData" = '' THEN '{}'::jsonb
      ELSE "orderData"::jsonb
    END
  );
