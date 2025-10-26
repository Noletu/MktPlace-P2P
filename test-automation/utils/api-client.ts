// API Client wrapper using axios

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export class APIClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor(baseURL: string = 'http://localhost:3001/api/v1') {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private getConfig(): AxiosRequestConfig {
    const config: AxiosRequestConfig = {};
    if (this.token) {
      config.headers = {
        Authorization: `Bearer ${this.token}`,
      };
    }
    return config;
  }

  async get(url: string, config?: AxiosRequestConfig) {
    const mergedConfig = { ...this.getConfig(), ...config };
    return this.client.get(url, mergedConfig);
  }

  async post(url: string, data?: any, config?: AxiosRequestConfig) {
    const mergedConfig = { ...this.getConfig(), ...config };
    return this.client.post(url, data, mergedConfig);
  }

  async put(url: string, data?: any, config?: AxiosRequestConfig) {
    const mergedConfig = { ...this.getConfig(), ...config };
    return this.client.put(url, data, mergedConfig);
  }

  async delete(url: string, config?: AxiosRequestConfig) {
    const mergedConfig = { ...this.getConfig(), ...config };
    return this.client.delete(url, mergedConfig);
  }

  // Helper methods for common operations
  async register(email: string, password: string, cpf: string, name: string) {
    return this.post('/auth/register', { email, password, cpf, name });
  }

  async login(email: string, password: string) {
    const response = await this.post('/auth/login', { email, password });
    if (response.data.data?.accessToken) {
      this.setToken(response.data.data.accessToken);
    }
    return response;
  }

  async getMe() {
    return this.get('/auth/me');
  }

  async submitKYCLevel1(fullName: string, cpf: string, phone: string) {
    return this.post('/kyc/level1', { fullName, cpf, phone });
  }

  async generateCollateralAddress(cryptoType: string, network: string, amount: string) {
    return this.post('/collateral-balance/deposit', {
      cryptoType,
      network,
      amount,
    });
  }

  async simulateDeposit(addressId: string) {
    return this.post(`/collateral-balance/simulate-deposit/${addressId}`);
  }

  async getBalances() {
    return this.get('/collateral-balance');
  }

  async createOrder(orderData: any) {
    return this.post('/orders', orderData);
  }

  async getMarketplace() {
    return this.get('/orders/marketplace');
  }

  async getOrder(orderId: string) {
    return this.get(`/orders/${orderId}`);
  }

  async matchOrder(orderId: string) {
    return this.post(`/orders/${orderId}/match`);
  }

  async submitProof(transactionId: string, proofData: any) {
    return this.post(`/transactions/${transactionId}/proof`, proofData);
  }

  async validateProof(transactionId: string, approved: boolean, reason?: string) {
    return this.post(`/transactions/${transactionId}/validate`, { approved, reason });
  }

  async createDispute(orderId: string, disputeData: any) {
    return this.post(`/orders/${orderId}/dispute`, disputeData);
  }

  async getDispute(disputeId: string) {
    return this.get(`/disputes/${disputeId}`);
  }

  async respondDispute(disputeId: string, response: string) {
    return this.post(`/disputes/${disputeId}/respond`, { response });
  }

  async resolveDispute(disputeId: string, resolutionType: string, resolutionDetails: string) {
    return this.post(`/disputes/${disputeId}/resolve`, { resolutionType, resolutionDetails });
  }
}
