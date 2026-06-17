import { prisma } from '../../src/utils/prisma';
import { auditLogService } from '../../src/services/auditLog.service';

const TEST_ACTION = 'MED33_AUDIT_SMOKE';

async function main() {
  let pass = 0, fail = 0;
  const check = (cond: boolean, label: string) => {
    if (cond) { pass++; console.log('  PASS:', label); }
    else { fail++; console.log('  FAIL:', label); }
  };

  try {
    const col = await prisma.$queryRaw<Array<{ data_type: string }>>`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'AuditLog' AND column_name = 'metadata'`;
    check(col[0]?.data_type === 'jsonb', `coluna metadata e jsonb (got: ${col[0]?.data_type})`);

    // caminho 1: log() com metadata OBJETO
    await auditLogService.log({ action: TEST_ACTION, resource: 'SMOKE', metadata: { via: 'object', n: 1 } });
    // caminho 2: log() com metadata STRING (rede de tolerancia)
    await auditLogService.log({ action: TEST_ACTION, resource: 'SMOKE', metadata: JSON.stringify({ via: 'string', n: 2 }) });
    // caminho 3: log() SEM metadata
    await auditLogService.log({ action: TEST_ACTION, resource: 'SMOKE' });
    // caminho 4: write DIRETO (classe dos workers/adminFunds) com objeto
    await prisma.auditLog.create({ data: { action: TEST_ACTION, resource: 'SMOKE_DIRECT', metadata: { via: 'direct-object', n: 4 } } });

    const rows = await prisma.$queryRaw<Array<{ resource: string; t: string | null; via: string | null }>>`
      SELECT resource, jsonb_typeof("metadata") AS t, ("metadata"->>'via') AS via
      FROM "AuditLog" WHERE action = ${TEST_ACTION} ORDER BY "createdAt"`;

    const r1 = rows.find(r => r.via === 'object');
    check(!!r1 && r1.t === 'object', `log() objeto -> jsonb object (got t=${r1?.t})`);
    const r2 = rows.find(r => r.via === 'string');
    check(!!r2 && r2.t === 'object', `log() string (tolerancia) -> jsonb object (got t=${r2?.t})`);
    const r3 = rows.find(r => r.resource === 'SMOKE' && r.via === null && r.t === null);
    check(!!r3, `log() sem metadata -> NULL`);
    const r4 = rows.find(r => r.via === 'direct-object');
    check(!!r4 && r4.t === 'object', `create direto objeto -> jsonb object (got t=${r4?.t})`);
  } finally {
    const del = await prisma.auditLog.deleteMany({ where: { action: TEST_ACTION } });
    console.log(`  cleanup: ${del.count} AuditLog de teste removidos`);
    await prisma.$disconnect();
  }

  console.log(`\nRESULTADO: ${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
