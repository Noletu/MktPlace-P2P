import { prisma } from '../../src/utils/prisma';
import { adminService } from '../../src/services/admin.service';
import { PendingApprovalService } from '../../src/services/pendingApproval.service';

async function main() {
  let pass = 0, fail = 0;
  const check = (c: boolean, l: string) => { if (c) { pass++; console.log('  PASS:', l); } else { fail++; console.log('  FAIL:', l); } };
  const ids: string[] = [];
  const approvalIds: string[] = [];

  async function ensure(email: string, legacyRole: string, slug: string) {
    const role = await prisma.role.findUnique({ where: { slug } });
    const u = await prisma.user.upsert({
      where: { email },
      update: { legacyRole, roleId: role?.id },
      create: { email, password: 'x', legacyRole, name: email, roleId: role?.id },
    });
    ids.push(u.id);
    return u;
  }

  try {
    const masterA = await ensure('f3-masterA@test.com', 'MASTER', 'master');
    const masterB = await ensure('f3-masterB@test.com', 'MASTER', 'master');
    const target  = await ensure('f3-target@test.com', 'ADMIN', 'admin'); // admin a ser promovido p/ master

    // 1) MASTER A inicia promocao de target -> MASTER. Deve VIRAR PENDING (nao executar).
    const result: any = await adminService.updateUser(target.id, { role: 'MASTER', reason: 'teste dupla aprovacao' } as any, masterA.id);
    check(result?._pending === true, 'promover p/ MASTER -> retorna _pending (enfileirado, nao executou)');
    const approvalId = result?.approval?.id;
    if (approvalId) approvalIds.push(approvalId);

    // target ainda NAO eh master (operacao nao executou)
    const targetAfterInit = await prisma.user.findUnique({ where: { id: target.id }, select: { legacyRole: true } });
    check(targetAfterInit?.legacyRole === 'ADMIN', 'target continua ADMIN enquanto pendente (nada mudou ainda)');

    // 2) O PROPRIO iniciador (Master A) NAO pode aprovar a propria operacao
    let selfApproveBlocked = false;
    try {
      await PendingApprovalService.approve({ approvalId, approverId: masterA.id });
    } catch { selfApproveBlocked = true; }
    check(selfApproveBlocked, 'iniciador NAO pode aprovar a propria operacao');

    // 3) Master B (segundo master) aprova -> executa de verdade
    await PendingApprovalService.approve({ approvalId, approverId: masterB.id });
    const targetAfterApprove = await prisma.user.findUnique({ where: { id: target.id }, select: { legacyRole: true } });
    check(targetAfterApprove?.legacyRole === 'MASTER', 'apos 2o MASTER aprovar -> target VIRA MASTER');

  } finally {
    // limpar approvals e usuarios de teste
    if (approvalIds.length) await prisma.pendingApproval.deleteMany({ where: { id: { in: approvalIds } } }).catch(() => {});
    await prisma.pendingApproval.deleteMany({ where: { initiatorId: { in: ids } } }).catch(() => {});
    if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
    console.log(`  cleanup: ${ids.length} users, ${approvalIds.length}+ approvals`);
    await prisma.$disconnect();
  }

  console.log(`\nRESULTADO: ${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
