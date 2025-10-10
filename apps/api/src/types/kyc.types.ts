export enum KYCLevel {
  NONE = 'NONE',
  LEVEL_1 = 'LEVEL_1',
  LEVEL_2 = 'LEVEL_2',
  LEVEL_3 = 'LEVEL_3',
  LEVEL_4 = 'LEVEL_4',
}

export enum KYCStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// --- LEVEL 1: CPF + Telefone + Nome Completo ---
export interface KYCLevel1SubmitData {
  fullName: string;
  cpf: string;
  phone: string;
}

// --- LEVEL 2: Level 1 + Endereço + Data de Nascimento ---
export interface KYCLevel2SubmitData extends KYCLevel1SubmitData {
  dateOfBirth: string; // ISO date format
  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string; // UF (2 chars)
    zipCode: string; // CEP (8 digits)
  };
}

// --- LEVEL 3: Level 2 + Documento + Selfie ---
export interface KYCLevel3SubmitData extends KYCLevel2SubmitData {
  documentType: 'RG' | 'CNH';
  documentNumber: string;
  documentFrontUrl: string;
  documentBackUrl?: string;
  selfieUrl: string;
}

// --- LEVEL 4: Level 3 + Comprovante de Residência ---
export interface KYCLevel4SubmitData extends KYCLevel3SubmitData {
  proofOfResidenceUrl: string;
  proofOfResidenceType: 'CONTA_LUZ' | 'CONTA_AGUA' | 'CONTA_TELEFONE' | 'EXTRATO_BANCARIO';
}

export type KYCSubmitData =
  | KYCLevel1SubmitData
  | KYCLevel2SubmitData
  | KYCLevel3SubmitData
  | KYCLevel4SubmitData;

// KYC Response (what comes back from DB)
export interface KYCVerificationData {
  id: string;
  userId: string;
  status: KYCStatus;
  level: KYCLevel;

  // Level 1
  fullName?: string;
  cpf?: string;
  phone?: string;
  phoneVerified?: boolean;
  phoneVerifiedAt?: Date;

  // Level 2
  dateOfBirth?: Date;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZipCode?: string;

  // Level 3
  documentType?: string;
  documentNumber?: string;
  documentFrontUrl?: string;
  documentBackUrl?: string;
  selfieUrl?: string;
  livenessScore?: number;
  livenessVerified?: boolean;

  // Level 4
  proofOfResidenceUrl?: string;
  proofOfResidenceType?: string;

  // Metadata
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  submittedAt: Date;
  approvedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const KYC_TRANSACTION_LIMITS = {
  [KYCLevel.NONE]: 1000,      // R$ 1.000 (1k)
  [KYCLevel.LEVEL_1]: 10000,  // R$ 10.000 (10k)
  [KYCLevel.LEVEL_2]: 50000,  // R$ 50.000 (50k)
  [KYCLevel.LEVEL_3]: 100000, // R$ 100.000 (100k)
  [KYCLevel.LEVEL_4]: Infinity, // Sem limite
};
