// SER-38: testes do módulo central de bcrypt (cost-12 padrão + needsRehash).
import bcrypt from 'bcryptjs';
import { hashPassword, comparePassword, needsRehash, SALT_ROUNDS } from '../bcrypt';

describe('SER-38: bcrypt utils', () => {
  it('SALT_ROUNDS é 12', () => {
    expect(SALT_ROUNDS).toBe(12);
  });

  it('hashPassword gera hash em cost-12', async () => {
    const hash = await hashPassword('senha-de-teste');
    expect(bcrypt.getRounds(hash)).toBe(12);
  });

  it('hashPassword gera hash que valida a senha correta e rejeita a errada', async () => {
    const hash = await hashPassword('senha-de-teste');
    expect(await comparePassword('senha-de-teste', hash)).toBe(true);
    expect(await comparePassword('senha-errada', hash)).toBe(false);
  });

  it('needsRehash detecta cost-10 (true) e cost-12 (false)', async () => {
    const legacy = await bcrypt.hash('senha-de-teste', 10);
    const atual = await hashPassword('senha-de-teste');
    expect(bcrypt.getRounds(legacy)).toBe(10);
    expect(needsRehash(legacy)).toBe(true);
    expect(needsRehash(atual)).toBe(false);
  });
});
