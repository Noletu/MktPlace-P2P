-- MED-33: converte disputeData de TEXT para JSONB preservando os dados existentes.
-- O Prisma gera DROP+ADD (destrutivo) para String->Json; substituido por
-- ALTER COLUMN ... USING, que faz o cast in-place. NULL e string vazia viram NULL;
-- o restante (JSON valido, como gravado via JSON.stringify) e convertido para jsonb.
ALTER TABLE "Transaction"
  ALTER COLUMN "disputeData" TYPE JSONB
  USING (CASE WHEN "disputeData" IS NULL OR "disputeData" = '' THEN NULL ELSE "disputeData"::jsonb END);
