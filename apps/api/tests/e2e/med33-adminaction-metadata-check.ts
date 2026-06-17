import { prisma } from '../../src/utils/prisma';
import { adminService } from '../../src/services/admin.service';

async function main() {
  let pass = 0, fail = 0;
  const ids: string[] = [];
  const check = (cond: boolean, label: string) => {
    if (cond) { pass++; console.log('  PASS:', label); }
    else { fail++; console.log('  FAIL:', label); }
  };

  try {
    const col = await prisma.$queryRaw<Array<{ data_type: string }>>`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'AdminAction' AND column_name = 'metadata'`;
    check(col[0]?.data_type === 'jsonb', `coluna metadata e jsonb (got: ${col[0]?.data_type})`);

    const admin = await prisma.user.findFirst({ where: { email: 'master@mktplace.com' }, select: { id: true } });
    if (!admin) throw new Error('master@mktplace.com nao encontrado no seed');

    // caminho 1: metadata como STRING (callers atuais, stringify)
    const r1 = await adminService.logAdminAction({
      adminId: admin.id, action: 'TEST_STR', resource: 'MED33_SMOKE',
      metadata: JSON.stringify({ via: 'string', n: 1 }),
    });
    ids.push(r1.id);
    const t1 = await prisma.$queryRaw<Array<{ t: string }>>`
      SELECT jsonb_typeof("metadata") AS t FROM "AdminAction" WHERE id = ${r1.id}`;
    check(t1[0]?.t === 'object', `string -> jsonb object (got: ${t1[0]?.t})`);
    const v1 = await prisma.adminAction.findUnique({ where: { id: r1.id }, select: { metadata: true } });
    check((v1?.metadata as any)?.via === 'string' && (v1?.metadata as any)?.n === 1, 'valor preservado (caminho string)');

    // caminho 2: metadata como OBJETO (futuro)
    const r2 = await adminService.logAdminAction({
      adminId: admin.id, action: 'TEST_OBJ', resource: 'MED33_SMOKE',
      metadata: { via: 'object', nested: { ok: true } },
    });
    ids.push(r2.id);
    const t2 = await prisma.$queryRaw<Array<{ t: string }>>`
      SELECT jsonb_typeof("metadata") AS t FROM "AdminAction" WHERE id = ${r2.id}`;
    check(t2[0]?.t === 'object', `objeto -> jsonb object (got: ${t2[0]?.t})`);
    const v2 = await prisma.adminAction.findUnique({ where: { id: r2.id }, select: { metadata: true } });
    check((v2?.metadata as any)?.nested?.ok === true, 'valor preservado (caminho objeto)');

    // caminho 3: sem metadata -> NULL
    const r3 = await adminService.logAdminAction({
      adminId: admin.id, action: 'TEST_NULL', resource: 'MED33_SMOKE',
    });
    ids.push(r3.id);
    const t3 = await prisma.$queryRaw<Array<{ m: any }>>`
      SELECT "metadata" AS m FROM "AdminAction" WHERE id = ${r3.id}`;
    check(t3[0]?.m === null, `sem metadata -> NULL (got: ${JSON.stringify(t3[0]?.m)})`);
  } finally {
    if (ids.length) {
      await prisma.adminAction.deleteMany({ where: { id: { in: ids } } });
      console.log(`  cleanup: ${ids.length} AdminAction de teste removidas`);
    }
    await prisma.$disconnect();
  }

  console.log(`\nRESULTADO: ${pass} pass / ${fail} fail`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main();
