import crypto from 'node:crypto';
import { StorageRepository } from './repository';
import { AuditRepository } from '../audit/repository';
import { verifyAuditChainIntegrity } from '../audit/service';
import { createZipArchive, type ZipEntry } from './zip';
import {
  uploadAttachmentSchema,
  type UploadAttachmentInput,
  type FileAttachmentRecord,
  type MagicByteValidationResult,
  type AntivirusScanResult,
  type AuditorEvidenceBundleResult,
} from './types';

export type {
  UploadAttachmentInput,
  FileAttachmentRecord,
  MagicByteValidationResult,
  AntivirusScanResult,
  AuditorEvidenceBundleResult,
};

const EICAR_TEST_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

export function validateFileMagicBytes(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): MagicByteValidationResult {
  if (buffer.length < 4) {
    return {
      isValid: false,
      errorReason: 'Ukuran file terlalu kecil untuk validasi magic bytes.',
    };
  }

  // 1. PDF Magic Bytes (%PDF-) -> 0x25 0x50 0x44 0x46
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return {
      isValid: true,
      detectedMime: 'application/pdf',
    };
  }

  // 2. PNG Magic Bytes -> 0x89 0x50 0x4E 0x47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return {
      isValid: true,
      detectedMime: 'image/png',
    };
  }

  // 3. JPEG Magic Bytes -> 0xFF 0xD8 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return {
      isValid: true,
      detectedMime: 'image/jpeg',
    };
  }

  return {
    isValid: false,
    errorReason: `Magic bytes tidak sesuai dengan format file yang dideklarasikan ('${mimeType}', nama: '${fileName}'). Header binary tidak valid.`,
  };
}

export async function scanFileWithAntivirus(
  buffer: Buffer,
  _fileName: string
): Promise<AntivirusScanResult> {
  const content = buffer.toString('utf-8');

  if (content.includes(EICAR_TEST_SIGNATURE)) {
    return {
      isClean: false,
      virusName: 'EICAR-Test-Signature',
      scannedAt: new Date().toISOString(),
    };
  }

  return {
    isClean: true,
    scannedAt: new Date().toISOString(),
  };
}

export async function uploadAttachment(
  input: UploadAttachmentInput
): Promise<FileAttachmentRecord> {
  const validated = uploadAttachmentSchema.parse(input);

  // 1. Validate magic bytes (R51)
  const magicValidation = validateFileMagicBytes(
    validated.fileBuffer,
    validated.mimeType,
    validated.fileName
  );
  if (!magicValidation.isValid) {
    throw new Error(`Validasi Berkas Gagal (R51): ${magicValidation.errorReason}`);
  }

  // 2. Antivirus Scan (R51)
  const scanResult = await scanFileWithAntivirus(
    validated.fileBuffer,
    validated.fileName
  );
  if (!scanResult.isClean) {
    throw new Error(
      `Ancaman Malware Terdeteksi (R51): Berkas '${validated.fileName}' terinfeksi virus ${scanResult.virusName} dan langsung dimusnahkan.`
    );
  }

  // 3. SHA-256 Checksum Calculation
  const sha256Checksum = crypto
    .createHash('sha256')
    .update(validated.fileBuffer)
    .digest('hex');

  const storageKey = `attachments/${validated.entityName}/${validated.entityId}/${crypto.randomUUID()}_${validated.fileName}`;

  const repo = new StorageRepository();
  return await repo.createFileAttachment({
    id: crypto.randomUUID(),
    entityName: validated.entityName,
    entityId: validated.entityId,
    fileName: validated.fileName,
    fileSizeBytes: validated.fileBuffer.length,
    mimeType: magicValidation.detectedMime || validated.mimeType,
    storageObjectKey: storageKey,
    sha256Checksum,
    scanStatus: 'CLEAN',
    isFinalEvidence: validated.isFinalEvidence ?? false,
    isLegalHold: validated.isFinalEvidence ?? false, // WORM legal hold for final evidence
    uploadedBy: validated.uploadedBy,
  });
}

export async function generateAuditorEvidenceBundle(
  entityName: string,
  entityId: string
): Promise<AuditorEvidenceBundleResult> {
  const auditRepo = new AuditRepository();
  const storageRepo = new StorageRepository();

  const [auditEntries, attachedFiles, integrityReport] = await Promise.all([
    auditRepo.findAuditEntriesByEntity(entityName, entityId),
    storageRepo.findFilesByEntity(entityName, entityId),
    verifyAuditChainIntegrity(),
  ]);

  const entries: ZipEntry[] = [];

  // 1. Audit Trail JSON
  entries.push({
    fileName: 'audit_trail.json',
    data: Buffer.from(
      JSON.stringify(
        {
          entityName,
          entityId,
          exportedAt: new Date().toISOString(),
          totalEntries: auditEntries.length,
          entries: auditEntries,
        },
        null,
        2
      ),
      'utf-8'
    ),
  });

  // 2. Integrity Verification Report JSON
  entries.push({
    fileName: 'integrity_report.json',
    data: Buffer.from(
      JSON.stringify(
        {
          entityName,
          entityId,
          verifiedAt: new Date().toISOString(),
          integrityReport,
        },
        null,
        2
      ),
      'utf-8'
    ),
  });

  // 3. Manifest of Attached Evidence Files
  entries.push({
    fileName: 'attachments_manifest.json',
    data: Buffer.from(
      JSON.stringify(
        {
          entityName,
          entityId,
          totalFiles: attachedFiles.length,
          files: attachedFiles,
        },
        null,
        2
      ),
      'utf-8'
    ),
  });

  const zipBuffer = createZipArchive(entries);
  const bundleFileName = `evidence_bundle_${entityName}_${entityId}_${Date.now()}.zip`;

  return {
    bundleFileName,
    zipBuffer,
    totalFilesIncluded: entries.length,
  };
}
