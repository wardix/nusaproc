# 📋 NusaProc — Business Rules & Governance Cheat Sheet
### Acuan Cepat Aturan Bisnis & Tata Kelola Pengadaan PT Nusanet

---

## 🛡️ 1. Matriks Penegakan Separation of Duties (SoD)

| Kode Aturan | Domain Transaksi | Pembatasan & Penegakan SoD |
| :--- | :--- | :--- |
| **R4, R13** | Approval PR | Approval hanya sah jika approver memiliki wewenang aktif dan dalam limit plafon. |
| **R5, R43** | Step-Up Reauth | Eksekusi transfer dana kas wajib menyertakan token otentikasi ulang (5 menit). |
| **R9** | PR Submission | Pembuat PR dilarang menyetujui PR miliknya sendiri (*Anti Self-Approval*). |
| **R18, R19** | Verifikasi Bank | Verifikasi rekening bank vendor wajib 2 tahap (*4-Eyes Principle*), dikonfirmasi oleh 2 staf berbeda. |
| **R24** | Penerbitan PO | PO dilarang diterbitkan jika vendor / rekening bank belum berstatus `VERIFIED`. |
| **R25** | Approval PO | Pembuat PO (*author*) dilarang menyetujui PO yang dibuatnya sendiri. |
| **R26** | Amandemen PO | PO berstatus `ISSUED` tidak boleh diedit langsung, wajib melalui nomor amandemen resmi. |
| **R31** | Penerimaan BAST | Kuantitas barang diterima dilarang melebihi sisa kuantitas pesanan PO (*Over-Receipt Guard*). |
| **R33** | Invoice Entry | Staf penerima BAST dilarang merekam invoice tagihan untuk PO yang sama. |
| **R34** | Anti-Duplicate Inv | Invoice dengan vendor, nomor faktur, dan tanggal yang identik langsung ditolak. |
| **R38** | 2-Way Matcher | Selisih harga/kuantitas $> 1.0\%$ dan $> \text{Rp } 100.000$ berstatus `MATCHED_WITH_EXCEPTION`. |
| **R39** | Exception Override | Hanya Head of AP yang berhak meng-override selisih dengan catatan tertulis wajib. |
| **R42** | Payment Workflow | Pembuat proposal pembayaran dilarang merangkap sebagai pemeriksa (*Checker*). |
| **R53** | SHA-256 Chaining | Setiap rekaman audit dikunci dengan SHA-256 chaining berbasis hash record sebelumnya. |
| **R54** | Auditor Sandbox | Peran `AUDITOR` dibatasi read-only; operasi mutasi data diblokir (*HTTP 405*). |
| **R61** | Webhook Dispatch | Payload webhook keluar ditandatangani HMAC-SHA256 pada header `X-NusaProc-Signature`. |
| **R62, R64** | Lifecycle Delegasi | Delegasi kedaluwarsa otomatis; penonaktifan user langsung mencabut seluruh delegasi. |
| **R65** | Blacklist Lock | Vendor berstatus `BLACKLISTED` diblokir total dari pembuatan dan amandemen PO. |

---

## 📑 2. Standar Validasi Faktur Pajak (NSFP)

| Standar Faktur Pajak | Panjang Karakter | Contoh Format | Regex / Pola Validasi |
| :--- | :--- | :--- | :--- |
| **Legacy DJP** | 16 Karakter | `010.001-26.98765432` | `^\d{3}\.\d{3}-\d{2}\.\d{8}$` |
| **Coretax DJP** | 17 Karakter | `010.0001-26.98765432` | `^\d{3}\.\d{4}-\d{2}\.\d{8}$` |

---

## 🧮 3. Toleransi 2-Way Matching

- **Toleransi Nominal Maksimal:** $\le \text{Rp } 100.000$
- **Toleransi Persentase Maksimal:** $\le 1.0\%$

```
Status Evaluasi:
- Selisih == 0                       -> 🟢 MATCHED_OK (Exact Match)
- Selisih <= Rp 100k ATAU <= 1.0%    -> 🟡 MATCHED_OK (Within Tolerance)
- Selisih > Rp 100k DAN > 1.0%       -> 🔴 MATCHED_WITH_EXCEPTION (Held for Payment)
- Override Disetujui Head of AP      -> 🔵 EXCEPTION_OVERRIDDEN (Released for Payment)
```

---

## 👥 4. Matriks Peran & Wewenang (RBAC)

| Peran | Pembuatan Dokumen | Persetujuan | Verifikasi / Kontrol | Eksekusi Dana |
| :--- | :--- | :--- | :--- | :--- |
| **REQUESTER** | Draft PR | ❌ | ❌ | ❌ |
| **APPROVER** | ❌ | Approval PR (Sesuai Limit) | ❌ | ❌ |
| **ACCOUNT_PAYABLE** | Vendor, PO, Invoice, Proposal Bayar | Approval PO (SoD) | Verifikasi Bank Tahap 1, 2-Way Matcher | ❌ |
| **WAREHOUSE** | BAST (Penerimaan Barang), NCR | ❌ | Inspeksi Kuantitas & Fisik | ❌ |
| **FINANCE** | Proposal Bayar (Maker) | Check Proposal (Checker) | Verifikasi Pajak & Termin | Transfer Kas / Bank (Executor) |
| **AUDITOR** | ❌ | ❌ | Audit Trail Kriptografis, ZIP Evidence | ❌ (Read-Only) |
| **ADMIN** | User & Role Provisioning | ❌ | Manajemen Delegasi & Webhook | ❌ |
