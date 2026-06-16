import { Prisma } from '@prisma/client';
import { prisma } from '../../src/utils/prisma';
import { notifPrefsService } from '../../src/services/notificationPreferences.service';

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures++;
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? ' — ' + detail : ''}`);
}

async function main() {
  // Parte A: tolerância do getPreferences (objeto vs string), sem DB
  const fromObj = notifPrefsService.getPreferences({ WITHDRAWALS: 'email' });
  const fromStr = notifPrefsService.getPreferences('{"WITHDRAWALS":"email"}');
  check('objeto e string dao o mesmo merge', JSON.stringify(fromObj) === JSON.stringify(fromStr), JSON.stringify(fromObj));
  check('WITHDRAWALS respeitado (email)', fromObj.WITHDRAWALS === 'email');
  check('DEPOSITS volta ao default (both)', fromObj.DEPOSITS === 'both');
  check('null -> DEFAULTS', notifPrefsService.getPreferences(null).WITHDRAWALS === 'both');
  check('objeto vazio -> DEFAULTS', notifPrefsService.getPreferences({}).WITHDRAWALS === 'both');
  check('string invalida -> DEFAULTS (catch)', notifPrefsService.getPreferences('not json{{{').WITHDRAWALS === 'both');

  // Parte B: tipo da coluna no banco
  const colInfo = await prisma.$queryRaw<Array<{ data_type: string }>>`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'notificationPreferences'`;
  check('coluna e jsonb no banco', colInfo[0]?.data_type === 'jsonb', String(colInfo[0]?.data_type));

  // Parte C: ida-e-volta real num user de seed
  const user = await prisma.user.findUnique({
    where: { email: 'master@mktplace.com' },
    select: { id: true, notificationPreferences: true },
  });
  if (!user) { check('user de seed existe', false, 'master@mktplace.com nao encontrado'); return; }
  const original = user.notificationPreferences;

  await notifPrefsService.updatePreferences(user.id, { DEPOSITS: 'push' });

  const after = await prisma.user.findUnique({ where: { id: user.id }, select: { notificationPreferences: true } });
  const val = after?.notificationPreferences as Record<string, string> | null;
  check('releitura e objeto (nao string)', val !== null && typeof val === 'object' && !Array.isArray(val), typeof val);
  check('DEPOSITS gravado como push', val?.DEPOSITS === 'push');

  const jt = await prisma.$queryRaw<Array<{ t: string }>>`
    SELECT jsonb_typeof("notificationPreferences") AS t FROM "User" WHERE id = ${user.id}`;
  check('jsonb_typeof = object (gravou objeto, nao string)', jt[0]?.t === 'object', String(jt[0]?.t));

  // restaura o valor original do seed
  await prisma.user.update({
    where: { id: user.id },
    data: { notificationPreferences: original === null ? Prisma.DbNull : (original as Prisma.InputJsonValue) },
  });

  console.log(failures === 0 ? '\nTODOS OS CHECKS PASSARAM' : `\n${failures} CHECK(S) FALHARAM`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
