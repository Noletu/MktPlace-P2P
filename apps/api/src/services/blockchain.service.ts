import axios from 'axios';

/**
 * Serviço para monitorar blockchain e verificar transações
 * Suporta múltiplas redes e fornecedores de API
 */
export class BlockchainService {
  /**
   * Verifica se um endereço recebeu pagamento
   * @param address - Endereço a ser verificado
   * @param network - Rede blockchain (ETHEREUM, BASE, ARBITRUM, etc)
   * @param cryptoType - Tipo de cripto (BTC, USDT, USDC, etc)
   * @param expectedAmount - Valor esperado em unidades da cripto
   * @returns Dados da transação se encontrada, null caso contrário
   */
  async checkPayment(
    address: string,
    network: string,
    cryptoType: string,
    expectedAmount: string
  ): Promise<{
    received: boolean;
    txHash?: string;
    amount?: string;
    timestamp?: number;
    confirmations?: number;
  }> {
    try {
      // Bitcoin
      if (cryptoType === 'BTC') {
        return await this.checkBitcoinPayment(address, expectedAmount);
      }

      // Ethereum e redes EVM (Base, Arbitrum, etc)
      if (network === 'ETHEREUM' || network === 'BASE' || network === 'ARBITRUM') {
        // Se for token ERC20 (USDT, USDC, etc)
        if (cryptoType !== 'ETH') {
          return await this.checkERC20Payment(address, network, cryptoType, expectedAmount);
        } else {
          return await this.checkEthereumPayment(address, network, expectedAmount);
        }
      }

      // Tron (TRC20)
      if (network === 'TRC20') {
        return await this.checkTronPayment(address, cryptoType, expectedAmount);
      }

      throw new Error(`Rede não suportada: ${network}`);
    } catch (error: any) {
      console.error('❌ Erro ao verificar pagamento blockchain:', error.message);
      return { received: false };
    }
  }

  /**
   * Verifica pagamento Bitcoin via BlockCypher API
   */
  private async checkBitcoinPayment(
    address: string,
    expectedAmount: string
  ): Promise<{ received: boolean; txHash?: string; amount?: string; timestamp?: number; confirmations?: number }> {
    try {
      // BlockCypher API (gratuita para baixo volume)
      const response = await axios.get(
        `https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance`
      );

      const balanceBTC = response.data.balance / 100000000; // Satoshis para BTC
      const expected = parseFloat(expectedAmount);

      // Verificar se recebeu pelo menos o valor esperado
      if (balanceBTC >= expected) {
        // Buscar transações para pegar o hash
        const txResponse = await axios.get(
          `https://api.blockcypher.com/v1/btc/main/addrs/${address}/full?limit=1`
        );

        const lastTx = txResponse.data.txs?.[0];

        if (lastTx) {
          return {
            received: true,
            txHash: lastTx.hash,
            amount: balanceBTC.toString(),
            timestamp: new Date(lastTx.received).getTime(),
            confirmations: lastTx.confirmations || 0,
          };
        }
      }

      return { received: false };
    } catch (error: any) {
      console.error('Erro ao verificar Bitcoin:', error.message);
      return { received: false };
    }
  }

  /**
   * Verifica pagamento Ethereum/Base/Arbitrum via Etherscan-like API
   */
  private async checkEthereumPayment(
    address: string,
    network: string,
    expectedAmount: string
  ): Promise<{ received: boolean; txHash?: string; amount?: string; timestamp?: number }> {
    try {
      const apiUrl = this.getEtherscanApiUrl(network);
      const apiKey = this.getEtherscanApiKey(network);

      // Buscar saldo
      const response = await axios.get(apiUrl, {
        params: {
          module: 'account',
          action: 'balance',
          address: address,
          tag: 'latest',
          apikey: apiKey,
        },
      });

      if (response.data.status === '1') {
        const balanceWei = response.data.result;
        const balanceEth = parseFloat(balanceWei) / 1e18;
        const expected = parseFloat(expectedAmount);

        if (balanceEth >= expected) {
          // Buscar última transação
          const txResponse = await axios.get(apiUrl, {
            params: {
              module: 'account',
              action: 'txlist',
              address: address,
              startblock: 0,
              endblock: 99999999,
              page: 1,
              offset: 1,
              sort: 'desc',
              apikey: apiKey,
            },
          });

          const lastTx = txResponse.data.result?.[0];

          if (lastTx) {
            return {
              received: true,
              txHash: lastTx.hash,
              amount: balanceEth.toString(),
              timestamp: parseInt(lastTx.timeStamp) * 1000,
            };
          }
        }
      }

      return { received: false };
    } catch (error: any) {
      console.error('Erro ao verificar Ethereum:', error.message);
      return { received: false };
    }
  }

  /**
   * Verifica pagamento de token ERC20 (USDT, USDC, etc)
   */
  private async checkERC20Payment(
    address: string,
    network: string,
    tokenSymbol: string,
    expectedAmount: string
  ): Promise<{ received: boolean; txHash?: string; amount?: string; timestamp?: number }> {
    try {
      const apiUrl = this.getEtherscanApiUrl(network);
      const apiKey = this.getEtherscanApiKey(network);
      const tokenAddress = this.getTokenAddress(network, tokenSymbol);

      // Buscar saldo do token
      const response = await axios.get(apiUrl, {
        params: {
          module: 'account',
          action: 'tokenbalance',
          contractaddress: tokenAddress,
          address: address,
          tag: 'latest',
          apikey: apiKey,
        },
      });

      if (response.data.status === '1') {
        const balance = parseFloat(response.data.result) / 1e6; // USDT/USDC tem 6 decimais
        const expected = parseFloat(expectedAmount);

        if (balance >= expected) {
          // Buscar transferências de token
          const txResponse = await axios.get(apiUrl, {
            params: {
              module: 'account',
              action: 'tokentx',
              contractaddress: tokenAddress,
              address: address,
              page: 1,
              offset: 1,
              sort: 'desc',
              apikey: apiKey,
            },
          });

          const lastTx = txResponse.data.result?.[0];

          if (lastTx && lastTx.to.toLowerCase() === address.toLowerCase()) {
            return {
              received: true,
              txHash: lastTx.hash,
              amount: balance.toString(),
              timestamp: parseInt(lastTx.timeStamp) * 1000,
            };
          }
        }
      }

      return { received: false };
    } catch (error: any) {
      console.error('Erro ao verificar ERC20:', error.message);
      return { received: false };
    }
  }

  /**
   * Verifica pagamento Tron (TRC20)
   */
  private async checkTronPayment(
    address: string,
    tokenSymbol: string,
    expectedAmount: string
  ): Promise<{ received: boolean; txHash?: string; amount?: string; timestamp?: number }> {
    try {
      // TronGrid API
      const response = await axios.get(
        `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`,
        {
          params: {
            limit: 10,
            only_to: true,
          },
        }
      );

      const transactions = response.data.data || [];
      const expected = parseFloat(expectedAmount) * 1e6; // USDT TRC20 tem 6 decimais

      for (const tx of transactions) {
        if (tx.token_info.symbol === tokenSymbol) {
          const amount = parseFloat(tx.value);

          if (amount >= expected) {
            return {
              received: true,
              txHash: tx.transaction_id,
              amount: (amount / 1e6).toString(),
              timestamp: tx.block_timestamp,
            };
          }
        }
      }

      return { received: false };
    } catch (error: any) {
      console.error('Erro ao verificar Tron:', error.message);
      return { received: false };
    }
  }

  /**
   * Retorna URL da API Etherscan para cada rede
   */
  private getEtherscanApiUrl(network: string): string {
    const urls: Record<string, string> = {
      ETHEREUM: 'https://api.etherscan.io/api',
      BASE: 'https://api.basescan.org/api',
      ARBITRUM: 'https://api.arbiscan.io/api',
    };

    return urls[network] || urls.ETHEREUM;
  }

  /**
   * Retorna API key do Etherscan (configurar no .env)
   */
  private getEtherscanApiKey(network: string): string {
    // TODO: Adicionar ao .env
    // ETHERSCAN_API_KEY=
    // BASESCAN_API_KEY=
    // ARBISCAN_API_KEY=

    const keys: Record<string, string> = {
      ETHEREUM: process.env.ETHERSCAN_API_KEY || '',
      BASE: process.env.BASESCAN_API_KEY || '',
      ARBITRUM: process.env.ARBISCAN_API_KEY || '',
    };

    return keys[network] || '';
  }

  /**
   * Retorna endereço do contrato do token
   */
  private getTokenAddress(network: string, symbol: string): string {
    const addresses: Record<string, Record<string, string>> = {
      ETHEREUM: {
        USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      },
      BASE: {
        USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      },
      ARBITRUM: {
        USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      },
    };

    return addresses[network]?.[symbol] || '';
  }
}

export const blockchainService = new BlockchainService();
