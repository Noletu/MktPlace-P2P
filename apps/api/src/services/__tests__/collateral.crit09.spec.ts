// CRIT-09: guard de produção em simulatePaymentReceived.
// A função credita saldo arbitrariamente — em prod tem que lançar antes de
// fazer qualquer side effect (incluindo ler a wallet do DB).
//
// O setup.ts global mocka @prisma/client + logger; aqui isolamos para garantir
// que o guard dispara ANTES de qualquer chamada ao Prisma/WalletService.
jest.mock('../wallet.service', () => ({
  WalletService: {
    getWallet: jest.fn(),
    creditBalance: jest.fn(),
  },
}));

import { collateralService } from '../collateral.service';
import { WalletService } from '../wallet.service';

describe('CRIT-09: simulatePaymentReceived bloqueado em produção', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
  });

  it('lança em NODE_ENV=production ANTES de tocar wallet.service', async () => {
    process.env.NODE_ENV = 'production';

    await expect(
      collateralService.simulatePaymentReceived('w-1', '1.5', 'tx-hash-x'),
    ).rejects.toThrow(/disabled in production/);

    expect(WalletService.getWallet).not.toHaveBeenCalled();
    expect(WalletService.creditBalance).not.toHaveBeenCalled();
  });

  it('permite execução em development (passa do guard até wallet not found)', async () => {
    process.env.NODE_ENV = 'development';
    (WalletService.getWallet as jest.Mock).mockResolvedValue(null);

    await expect(
      collateralService.simulatePaymentReceived('w-missing', '1', 'tx'),
    ).rejects.toThrow(/Wallet not found/);

    expect(WalletService.getWallet).toHaveBeenCalledWith('w-missing');
  });

  it('permite execução em test (passa do guard até wallet not found)', async () => {
    process.env.NODE_ENV = 'test';
    (WalletService.getWallet as jest.Mock).mockResolvedValue(null);

    await expect(
      collateralService.simulatePaymentReceived('w-missing', '1', 'tx'),
    ).rejects.toThrow(/Wallet not found/);

    expect(WalletService.getWallet).toHaveBeenCalled();
  });
});
