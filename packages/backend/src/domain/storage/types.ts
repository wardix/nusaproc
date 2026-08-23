import { z } from 'zod';

export type ScanStatus = 'SCANNING' | 'CLEAN' | 'INFECTED';

export interface FileAttachmentRecord {
  id: string;
  entityName: string;
  entityId: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  storageObjectKey: string;
  sha256Checksum: string;
  scanStatus: ScanStatus;
  isFinalEvidence: boolean;
  isLegalHold: boolean;
  uploadedBy: string;
  createdAt: string;
}

export interface UploadAttachmentInput {
  entityName: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  uploadedBy: string;
  isFinalEvidence?: boolean;
}

export interface MagicByteValidationResult {
  isValid: boolean;
  detectedMime?: string;
  errorReason?: string;
}

export interface AntivirusScanResult {
  isClean: boolean;
  virusName?: string;
  scannedAt: string;
}

export interface AuditorEvidenceBundleResult {
  bundleFileName: string;
  zipBuffer: Buffer;
  totalFilesIncluded: number;
}

export const uploadAttachmentSchema = z.object({
  entityName: z.string().min(1, 'Entity name wajib diisi'),
  entityId: z.string().uuid('Entity ID wajib valid UUID'),
  fileName: z.string().min(1, 'File name wajib diisi'),
  mimeType: z.string().min(1, 'Mime type wajib diisi'),
  fileBuffer: z.instanceof(Buffer, { message: 'File buffer wajib berupa Buffer' }),
  uploadedBy: z.string().uuid('Uploaded by wajib valid UUID'),
  isFinalEvidence: z.boolean().optional().default(false),
});
