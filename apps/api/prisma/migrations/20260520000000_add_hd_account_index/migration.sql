-- CRIT-02: hdAccountIndex persistido via Postgres SEQUENCE (anti-colisão de custódia).
--
-- Por que SEQUENCE em vez de autoincrement Prisma?
-- Prisma @default(autoincrement()) gera BIGSERIAL (OK), mas usamos @default(dbgenerated(...))
-- para nomear explicitamente a sequence ("user_hd_account_seq") e documentar a invariante:
-- account 0 é reservado para a carteira da plataforma; usuários começam em 1.
-- A sequence garante que dois INSERTs simultâneos nunca recebem o mesmo índice.
--
-- Invariante de imutabilidade: hdAccountIndex NÃO tem trigger de update.
-- Qualquer UPDATE que tente escrever neste campo deve ser bloqueado por revisão de código.
-- A única operação legítima é a leitura (para derivar o endereço).

-- 1. Criar sequence (começa em 1; account 0 reservado para plataforma)
-- DROP IF EXISTS: migrate reset dropa tabelas mas não sequences; garantimos estado limpo.
-- Em produção (primeiro deploy em DB virgem) o DROP é no-op.
DROP SEQUENCE IF EXISTS "user_hd_account_seq";
CREATE SEQUENCE "user_hd_account_seq"
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  NO CYCLE;

-- 2. Adicionar coluna com DEFAULT ligado à sequence
ALTER TABLE "User"
  ADD COLUMN "hdAccountIndex" BIGINT NOT NULL DEFAULT nextval('user_hd_account_seq');

-- 3. Constraint UNIQUE garante que colisões são impossíveis mesmo em fallback de sequence
ALTER TABLE "User"
  ADD CONSTRAINT "User_hdAccountIndex_key" UNIQUE ("hdAccountIndex");
