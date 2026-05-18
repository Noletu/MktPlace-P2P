// CRIT-12: memzero da master seed após uso.
//
// Garante três propriedades de segurança de memória:
// 1. clearCache() zera o conteúdo do buffer ANTES de soltar a referência
//    (evita dado no heap até GC, core dumps, swap e /proc/<pid>/maps).
// 2. getMasterSeed() retorna CÓPIA defensiva — callers não podem reter
//    a referência interna além do TTL nem modificar o cache acidentalmente.
// 3. Timer ativo (com .unref()) zera o cache proativamente no TTL, sem
//    depender de uma próxima chamada a getMasterSeed().

import { MasterSeedService } from '../master-seed.service';

// Buffer conhecido de 64 bytes não-nulos para testes determinísticos
const KNOWN_SEED = Buffer.alloc(64, 0xab);

beforeAll(() => {
  process.env.MASTER_SEED_ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.MASTER_SEED_ENCRYPTED = 'placeholder:placeholder:placeholder';
  try {
    MasterSeedService.initialize();
  } catch {
    // Pode já estar inicializado de outro módulo no mesmo processo
  }
});

beforeEach(() => {
  // decryptSeed mockado para retornar semente conhecida — sem crypto real
  jest.spyOn(MasterSeedService as any, 'decryptSeed').mockReturnValue(
    Buffer.from(KNOWN_SEED),
  );
  // Estado limpo entre testes
  (MasterSeedService as any).clearCache();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  (MasterSeedService as any).clearCache();
});

describe('CRIT-12: memzero da master seed', () => {
  it('a) clearCache() zera todos os bytes do buffer cached', () => {
    MasterSeedService.getMasterSeed(); // popula cache

    const cached: Buffer = (MasterSeedService as any).cachedMasterSeed;
    expect(cached).not.toBeNull();
    expect(cached.some((b: number) => b !== 0)).toBe(true); // conteúdo não-zero

    const ref = cached; // referência antes do clear
    (MasterSeedService as any).clearCache();

    expect((MasterSeedService as any).cachedMasterSeed).toBeNull();
    // O mesmo buffer (via ref) deve estar zerado agora
    expect(ref.every((b: number) => b === 0)).toBe(true);
  });

  it('b) getMasterSeed retorna referências DISTINTAS com conteúdo IDÊNTICO (cópia defensiva)', () => {
    const a = MasterSeedService.getMasterSeed();
    const b = MasterSeedService.getMasterSeed();

    expect(a).not.toBe(b); // objetos distintos
    expect(a.equals(b)).toBe(true); // mesmo conteúdo

    a.fill(0);
    b.fill(0);
  });

  it('c) modificar a cópia retornada não afeta o cache interno', () => {
    const copy = MasterSeedService.getMasterSeed();
    const internal: Buffer = (MasterSeedService as any).cachedMasterSeed;
    const snapshot = Buffer.from(internal);

    copy.fill(0xff); // sobrescrever cópia do caller

    // Cache deve estar inalterado
    expect(internal.equals(snapshot)).toBe(true);

    copy.fill(0); // cleanup
  });

  it('d) timer ativo com .unref() é agendado e dispara clearCache após TTL', () => {
    jest.useFakeTimers();

    // Envolver o setTimeout falso para interceptar a chamada a .unref()
    let unrefCalled = false;
    const fakeSetTimeout = global.setTimeout;
    (global as any).setTimeout = (fn: () => void, ms?: number) => {
      const timer = fakeSetTimeout(fn, ms) as NodeJS.Timeout;
      if (typeof timer.unref === 'function') {
        const orig = timer.unref.bind(timer);
        timer.unref = () => {
          unrefCalled = true;
          return orig();
        };
      }
      return timer;
    };

    const clearCacheSpy = jest.spyOn(MasterSeedService as any, 'clearCache');

    MasterSeedService.getMasterSeed();

    expect((MasterSeedService as any).expiryTimer).not.toBeNull();
    expect(unrefCalled).toBe(true);

    jest.advanceTimersByTime((MasterSeedService as any).CACHE_TTL);

    expect(clearCacheSpy).toHaveBeenCalledTimes(1);

    (global as any).setTimeout = fakeSetTimeout; // restaurar
  });

  it('e) buffer é zerado no heap quando TTL expira via timer', () => {
    jest.useFakeTimers();

    MasterSeedService.getMasterSeed(); // popula cache

    const cached: Buffer = (MasterSeedService as any).cachedMasterSeed;
    const ref = cached;
    expect(ref.some((b: number) => b !== 0)).toBe(true); // não-zero antes

    jest.advanceTimersByTime((MasterSeedService as any).CACHE_TTL);

    expect((MasterSeedService as any).cachedMasterSeed).toBeNull();
    expect(ref.every((b: number) => b === 0)).toBe(true); // zerado após TTL
  });
});
