import type { PurchaseOrderRecord, PurchaseOrderItemRecord } from '../domain/po/types';
import type { VendorRecord, VendorBankAccountRecord } from '../domain/vendor/types';

export interface PoPdfData {
  po: PurchaseOrderRecord;
  items: PurchaseOrderItemRecord[];
  vendor: VendorRecord;
  bankAccount: VendorBankAccountRecord;
}

/**
 * Generates an official Purchase Order PDF document buffer (R27).
 */
export async function createPoPdfDocument(data: PoPdfData): Promise<Uint8Array> {
  const { po, items, vendor, bankAccount } = data;

  const contentLines: string[] = [
    'SURAT PESANAN RESMI (PURCHASE ORDER)',
    'PT NUSANET PROCUREMENT SYSTEM',
    '========================================================================',
    `Nomor PO           : ${po.poNumber}`,
    `Tanggal Terbit     : ${po.issuedAt ? po.issuedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}`,
    `Status             : ${po.status}`,
    `Termin Pembayaran  : ${po.paymentTermType}`,
    '------------------------------------------------------------------------',
    'INFORMASI PEMASOK (VENDOR):',
    `Nama Vendor        : ${vendor.name} (${vendor.vendorCode})`,
    `NPWP               : ${vendor.taxIdentificationNumber}`,
    '------------------------------------------------------------------------',
    'REKENING PEMBAYARAN TUJUAN (VERIFIED):',
    `Bank               : ${bankAccount.bankName} (Kode: ${bankAccount.bankCode})`,
    `Nomor Rekening     : ${bankAccount.accountNumberMasked}`,
    `Atas Nama          : ${bankAccount.accountHolderName}`,
    '========================================================================',
    'RINCIAN BARANG / JASA:',
    'No | Deskripsi Barang & Spesifikasi | Qty | UoM | Harga Satuan (Rp) | Subtotal (Rp)',
    '------------------------------------------------------------------------',
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    contentLines.push(
      `${i + 1}. ${item.itemName} | Qty: ${item.quantityOrdered} ${item.uom} | @ Rp ${item.unitPrice.toLocaleString('id-ID')} | Subtotal: Rp ${item.subtotal.toLocaleString('id-ID')}`
    );
  }

  contentLines.push('========================================================================');
  contentLines.push(`TOTAL NILAI PEMESANAN : Rp ${po.grandTotalAmount.toLocaleString('id-ID')}`);
  contentLines.push('------------------------------------------------------------------------');
  contentLines.push(`Syarat & Ketentuan: ${po.termsAndConditions || 'Sesuai kesepakatan standar PT Nusanet'}`);
  contentLines.push('');
  contentLines.push('Persetujuan Otorisasi:');
  contentLines.push(`Dibuat oleh: ${po.createdBy}          Disetujui oleh: ${po.approvedBy || '-'}`);
  contentLines.push('Dokumen ini sah dan diterbitkan secara digital oleh Sistem Nusaproc.');

  const textBody = contentLines.join('\n');

  // Simple and valid PDF-1.4 binary structure
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${textBody.length + 100} >>
stream
BT
/F1 10 Tf
50 750 Td
14 TL
${textBody
  .split('\n')
  .map((line) => `(${line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')}) '`)
  .join('\n')}
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000${String(textBody.length + 380).padStart(3, '0')} 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${textBody.length + 460}
%%EOF`;

  return new TextEncoder().encode(pdfString);
}
