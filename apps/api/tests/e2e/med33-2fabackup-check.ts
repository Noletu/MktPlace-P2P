import { Prisma } from '@prisma/client';
import { prisma } from '../../src/utils/prisma';
import { twoFactorService } from '../../src/services/twoFactor.service';
import { hashPassword } from '../../src/utils/bcrypt';

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures++;
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? ' — ' + detail : ''}`);
}

async function jsonbType(userId: string): Promise<string | null> {
  const r = await prisma.$queryRaw<Array<{ t: string }>>`
    SELECT jsonb_typeof("twoFactorBackupCodes") AS t FROM "User" WHERE id = ${userId}`;
  return r[0]?.t ?? null;
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'master@mktplace.com' },
    select: { id: true, twoFactorBackupCodes: true },
  });
  if (!user) { check('user de seed existe', false, 'master@mktplace.com nao encontrado'); return; }
  const userId = user.id;
  const original = user.twoFactorBackupCodes;

  const colInfo = await prisma.$queryRaw<Array<{ data_type: string }>>`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'twoFactorBackupCodes'`;
  check('coluna e jsonb', colInfo[0]?.data_type === 'jsonb', String(colInfo[0]?.data_type));

  // grava array de 2 hashes (1 do code de teste, outro dummy) — nao imprime hashes
  const TEST_CODE = 'ABCDEF0123'; // 10 hex uppercase, normaliza pra ele mesmo
  const h1 = await hashPassword(TEST_CODE);
  const h2 = await hashPassword('1111111111');
  await prisma.user.update({ where: { id: userId }, data: { twoFactorBackupCodes: [h1, h2] } });

  check('grava array -> jsonb_typeof = array', (await jsonbType(userId)) === 'array');
  check('getBackupCodesCount le array = 2', (await twoFactorService.getBackupCodesCount(userId)) === 2);

  const used = await twoFactorService.useBackupCode(userId, TEST_CODE);
  check('useBackupCode consome (retorna true)', used === true);
  check('apos consumo, count = 1', (await twoFactorService.getBackupCodesCount(userId)) === 1);
  check('apos consumo, ainda jsonb_typeof = array', (await jsonbType(userId)) === 'array');

  const usedAgain = await twoFactorService.useBackupCode(userId, TEST_CODE);
  check('code ja usado nao funciona de novo (false)', usedAgain === false);

  // tolerancia: string JSON legada dentro do jsonb -> ramo typeof === 'string'
  await prisma.user.update({ where: { id: userId }, data: { twoFactorBackupCodes: '["x","y"]' } });
  check('string legada -> jsonb_typeof = string', (await jsonbType(userId)) === 'string');
  check('tolerancia: count le string legada = 2', (await twoFactorService.getBackupCodesCount(userId)) === 2);

  // DbNull no disable
  await prisma.user.update({ where: { id: userId }, data: { twoFactorBackupCodes: Prisma.DbNull } });
  check('DbNull -> count = 0 (guard)', (await twoFactorService.getBackupCodesCount(userId)) === 0);

  // restaura o valor original do seed
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorBackupCodes: original === null ? Prisma.DbNull : (original as Prisma.InputJsonValue) },
  });

  console.log(failures === 0 ? '\nTODOS OS CHECKS PASSARAM' : `\n${failures} CHECK(S) FALHARAM`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
