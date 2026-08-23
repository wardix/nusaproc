import { sql, type TransactionClient } from '../../db/client';
import type { FileAttachmentRecord, ScanStatus } from './types';

export class StorageRepository {
  constructor(private db: TransactionClient = sql) {}

  async createFileAttachment(file: {
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
  }): Promise<FileAttachmentRecord> {
    const rows = await this.db`
      INSERT INTO file_attachment (
        id, entity_name, entity_id, file_name, file_size_bytes,
        mime_type, storage_object_key, sha256_checksum, scan_status,
        is_final_evidence, is_legal_hold, uploaded_by
      ) VALUES (
        ${file.id}, ${file.entityName}, ${file.entityId}, ${file.fileName},
        ${file.fileSizeBytes}, ${file.mimeType}, ${file.storageObjectKey},
        ${file.sha256Checksum}, ${file.scanStatus}, ${file.isFinalEvidence},
        ${file.isLegalHold}, ${file.uploadedBy}
      )
      RETURNING
        id, entity_name AS "entityName", entity_id AS "entityId",
        file_name AS "fileName", file_size_bytes::float AS "fileSizeBytes",
        mime_type AS "mimeType", storage_object_key AS "storageObjectKey",
        sha256_checksum AS "sha256Checksum", scan_status AS "scanStatus",
        is_final_evidence AS "isFinalEvidence", is_legal_hold AS "isLegalHold",
        uploaded_by AS "uploadedBy", created_at::text AS "createdAt"
    `;

    return rows[0] as unknown as FileAttachmentRecord;
  }

  async findFilesByEntity(
    entityName: string,
    entityId: string
  ): Promise<FileAttachmentRecord[]> {
    const rows = await this.db`
      SELECT
        id, entity_name AS "entityName", entity_id AS "entityId",
        file_name AS "fileName", file_size_bytes::float AS "fileSizeBytes",
        mime_type AS "mimeType", storage_object_key AS "storageObjectKey",
        sha256_checksum AS "sha256Checksum", scan_status AS "scanStatus",
        is_final_evidence AS "isFinalEvidence", is_legal_hold AS "isLegalHold",
        uploaded_by AS "uploadedBy", created_at::text AS "createdAt"
      FROM file_attachment
      WHERE entity_name = ${entityName} AND entity_id = ${entityId}
      ORDER BY created_at ASC
    `;

    return rows as unknown as FileAttachmentRecord[];
  }
}
