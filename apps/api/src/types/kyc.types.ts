export enum KYCLevel {
  NONE = 'NONE',
  LEVEL_1 = 'LEVEL_1',
  LEVEL_2 = 'LEVEL_2',
  LEVEL_3 = 'LEVEL_3',
  LEVEL_4 = 'LEVEL_4',
}

export interface KYCLevel1Data {
  fullName: string;
  dateOfBirth: string; // ISO date format
  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export interface KYCLevel2Data extends KYCLevel1Data {
  documentType: 'RG' | 'CNH';
  documentNumber: string;
  documentFrontUrl: string;
  documentBackUrl?: string;
}

export interface KYCLevel3Data extends KYCLevel2Data {
  selfieUrl: string;
  livenessScore: number;
}

export interface KYCLevel4Data extends KYCLevel3Data {
  proofOfResidenceUrl: string;
  proofOfResidenceType: 'CONTA_LUZ' | 'CONTA_AGUA' | 'CONTA_TELEFONE' | 'EXTRATO_BANCARIO';
}

export type KYCData = KYCLevel1Data | KYCLevel2Data | KYCLevel3Data | KYCLevel4Data;

export const KYC_TRANSACTION_LIMITS = {
  [KYCLevel.NONE]: 0,
  [KYCLevel.LEVEL_1]: 500,
  [KYCLevel.LEVEL_2]: 2000,
  [KYCLevel.LEVEL_3]: 10000,
  [KYCLevel.LEVEL_4]: Infinity,
};
