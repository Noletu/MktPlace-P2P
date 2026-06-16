import { prisma } from '../../src/utils/prisma';
import { notificationService } from '../../src/services/notification.service';

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures++;
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? ' — ' + detail : ''}`);
}
async function jsonbType(id: string): Promise<string | null> {
  const r = await prisma.$queryRaw<Array<{ t: string | null }>>`
    SELECT jsonb_typeof("metadata") AS t FROM "Notification" WHERE id = ${id}`;
  return r[0]?.t ?? null;
}

async function main() {
  const colInfo = await prisma.$queryRaw<Array<{ data_type: string }>>`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'Notification' AND column_name = 'metadata'`;
  check('coluna e jsonb', colInfo[0]?.data_type === 'jsonb', String(colInfo[0]?.data_type));

  const user = await prisma.user.findUnique({ where: { email: 'master@mktplace.com' }, select: { id: true } });
  if (!user) { check('user de seed existe', false, 'master nao encontrado'); return; }
  const userId = user.id;

  const ids: string[] = [];
  try {
    await notificationService.createNotification({ userId, type: 'TEST', category: 'SECURITY', title: 'smoke', message: 'meta-obj', metadata: { foo: 'bar', n: 1 } });
    const a = await prisma.notification.findFirst({ where: { userId, message: 'meta-obj' }, orderBy: { createdAt: 'desc' }, select: { id: true, metadata: true } });
    if (a) {
      ids.push(a.id);
      check('createNotification grava metadata como object', (await jsonbType(a.id)) === 'object');
      check('releitura e objeto, foo preservado', (a.metadata as any)?.foo === 'bar', typeof a.metadata);
    } else { check('notification meta-obj criada', false); }

    await notificationService.createNotification({ userId, type: 'TEST', category: 'SECURITY', title: 'smoke', message: 'meta-nul' });
    const b = await prisma.notification.findFirst({ where: { userId, message: 'meta-nul' }, orderBy: { createdAt: 'desc' }, select: { id: true } });
    if (b) {
      ids.push(b.id);
      check('sem metadata -> coluna NULL (Prisma.DbNull)', (await jsonbType(b.id)) === null);
    } else { check('notification meta-nul criada', false); }
  } finally {
    if (ids.length) await prisma.notification.deleteMany({ where: { id: { in: ids } } });
  }

  console.log(failures === 0 ? '\nTODOS OS CHECKS PASSARAM' : `\n${failures} CHECK(S) FALHARAM`);
  process.exitCode = failures === 0 ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
