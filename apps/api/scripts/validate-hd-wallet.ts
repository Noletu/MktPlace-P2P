/**
 * Validate HD Wallet System
 *
 * Script para validar que todo o sistema HD Wallet está configurado corretamente.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Carregar .env explicitamente
dotenv.config({path: path.join(__dirname, '..', '.env')});

import {validateHDWalletSystem} from '../src/services/hd-wallet';

try {
  validateHDWalletSystem();
  console.log('✅ Sistema HD Wallet está funcionando corretamente!\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Falha na validação:', (error as Error).message);
  process.exit(1);
}
