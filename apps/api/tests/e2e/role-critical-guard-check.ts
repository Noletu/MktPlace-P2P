import { prisma } from '../../src/utils/prisma';
import { roleService } from '../../src/services/role.service';
import { PendingApprovalService } from '../../src/services/pendingApproval.service';

async function main() {
  let pass = 0, fail = 0;
  const check = (c: boolean, l: string) => { if (c) { pass++; console.log('  PASS:', l); } else { fail++; console.log('  FAIL:', l); } };
  const userIds: string[] = [];
  const roleIds: string[] = [];
  const approvalIds: string[] = [];

  async function ensureMaster(email: string) {
    const role = await prisma.role.findUnique({ where: { slug: 'master' } });
    const u = await prisma.user.upsert({
      where: { email }, update: { roleId: role?.id, legacyRole: 'MASTER' },
      create: { email, password: 'x', name: email, roleId: role?.id, legacyRole: 'MASTER' },
    });
    userIds.push(u.id); return u;
  }

  try {
    const masterA = await ensureMaster('f4-masterA@test.com');
    const masterB = await ensureMaster('f4-masterB@test.com');

    // pegar uma permissao CRITICA e uma NAO-critica reais do banco
    const crit = await prisma.permission.findFirst({ where: { isCritical: true }, select: { id: true, name: true } });
    const nonCrit = await prisma.permission.findFirst({ where: { isCritical: false }, select: { id: true, name: true } });
    if (!crit || !nonCrit) throw new Error('preciso de 1 permissao critica e 1 nao-critica no seed');

    // ---- CENARIO 1: criar role SO com nao-critica -> executa direto (sem pending) ----
    const r1: any = await roleService.createRole({
      name: 'Role Visualizador Teste', level: 30, permissionIds: [nonCrit.id], createdBy: masterA.id,
    } as any);
    check(!r1?._pending && r1?.id, 'criar role so com NAO-critica -> executa direto (sem aprovacao)');
    if (r1?.id) roleIds.push(r1.id);

    // ---- CENARIO 2: criar role COM critica -> enfileira (nada criado ainda) ----
    const rolesBefore = await prisma.role.count();
    const r2: any = await roleService.createRole({
      name: 'Role Fantasma Teste', level: 30, permissionIds: [crit.id, nonCrit.id], createdBy: masterA.id,
    } as any);
    check(r2?._pending === true, 'criar role COM critica -> _pending (enfileirado)');
    const rolesAfter = await prisma.role.count();
    check(rolesBefore === rolesAfter, 'role-fantasma NAO foi criado enquanto pendente (atomico)');
    const approvalId = r2?.approval?.id;
    if (approvalId) approvalIds.push(approvalId);

    // ---- CENARIO 3: iniciador NAO pode auto-aprovar ----
    let selfBlocked = false;
    try { await PendingApprovalService.approve({ approvalId, approverId: masterA.id }); } catch { selfBlocked = true; }
    check(selfBlocked, 'iniciador NAO pode aprovar a propria criacao de role');

    // ---- CENARIO 4: 2o MASTER aprova -> role-fantasma agora existe COM a permissao critica ----
    await PendingApprovalService.approve({ approvalId, approverId: masterB.id });
    const ghost = await prisma.role.findFirst({ where: { name: 'Role Fantasma Teste' }, select: { id: true } });
    check(!!ghost, 'apos 2o MASTER aprovar -> role-fantasma criado');
    if (ghost) {
      roleIds.push(ghost.id);
      const hasCrit = await prisma.rolePermission.findFirst({ where: { roleId: ghost.id, permissionId: crit.id } });
      check(!!hasCrit, 'role aprovado tem a permissao critica aplicada');
    }

    // ---- CENARIO 5: assignPermissionToRole com critica num role existente -> enfileira ----
    const r5: any = await roleService.assignPermissionToRole(r1.id, crit.id, masterA.id);
    check(r5?._pending === true, 'atribuir permissao critica a role existente -> _pending');
    if (r5?.approval?.id) approvalIds.push(r5.approval.id);
    const stillNoCrit = await prisma.rolePermission.findFirst({ where: { roleId: r1.id, permissionId: crit.id } });
    check(!stillNoCrit, 'permissao critica NAO aplicada enquanto pendente (atomico)');

  } finally {
    if (approvalIds.length) await prisma.pendingApproval.deleteMany({ where: { id: { in: approvalIds } } }).catch(() => {});
    await prisma.pendingApproval.deleteMany({ where: { initiatorId: { in: userIds } } }).catch(() => {});
    if (roleIds.length) await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } }).catch(() => {});
    if (roleIds.length) await prisma.role.deleteMany({ where: { id: { in: roleIds } } }).catch(() => {});
    await prisma.role.deleteMany({ where: { name: { in: ['Role Visualizador Teste', 'Role Fantasma Teste'] } } }).catch(() => {});
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    console.log(`  cleanup: ${userIds.length} users, ${roleIds.length} roles, approvals`);
    await prisma.$disconnect();
  }

  console.log(`\nRESULTADO: ${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
