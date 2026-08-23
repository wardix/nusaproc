import { sql } from './client';
import { runMigrations } from './migrate';
import { DEMO_PERSONAS } from '@nusaproc/shared';

export async function runSeed(): Promise<{ success: boolean; message: string }> {
  console.log('[Seed] Ensuring database migrations are up to date...');
  await runMigrations();

  console.log('[Seed] Seeding realistic PT Nusanet users and roles...');
  for (const persona of DEMO_PERSONAS) {
    await sql`
      INSERT INTO app_user (
        id, email, full_name, employee_id, division_id, branch_id,
        is_active, is_local_fallback, totp_enabled
      ) VALUES (
        ${persona.id},
        ${persona.email},
        ${persona.fullName},
        ${persona.employeeId},
        ${persona.divisionId},
        ${persona.branchId},
        TRUE,
        ${persona.role === 'ADMIN'},
        ${persona.role === 'ADMIN'}
      )
      ON CONFLICT (email) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        employee_id = EXCLUDED.employee_id,
        division_id = EXCLUDED.division_id,
        branch_id = EXCLUDED.branch_id,
        is_active = TRUE
    `;

    await sql`
      INSERT INTO user_role_assignment (
        user_id, role, assigned_by, valid_from
      ) VALUES (
        ${persona.id},
        ${persona.role},
        ${persona.id},
        CURRENT_DATE
      )
      ON CONFLICT (user_id, role) DO NOTHING
    `;
  }

  console.log('[Seed] Seeding Indonesian vendor catalog and bank accounts...');
  const vendor1Id = '20000000-0000-0000-0000-000000000001';
  const vendor2Id = '20000000-0000-0000-0000-000000000002';
  const vendor3Id = '20000000-0000-0000-0000-000000000003';

  const apMaker = DEMO_PERSONAS.find((p) => p.role === 'ACCOUNT_PAYABLE')!;
  const apChecker = DEMO_PERSONAS.find((p) => p.jobTitle.includes('Checker')) || apMaker;

  await sql`
    INSERT INTO vendor (
      id, vendor_code, name, tax_identification_number, is_pkp, status,
      created_by, approved_by_1, approved_at_1, approved_by_2, approved_at_2
    ) VALUES 
      (
        ${vendor1Id}, 'VEND-FIBER-001', 'PT Fiber Optik Nusantara', '01.234.567.8-012.000', TRUE, 'APPROVED',
        ${apMaker.id}, ${apMaker.id}, clock_timestamp(), ${apChecker.id}, clock_timestamp()
      ),
      (
        ${vendor2Id}, 'VEND-MITRA-002', 'PT Mitra Solusi Jaringan', '02.345.678.9-013.000', TRUE, 'APPROVED',
        ${apMaker.id}, ${apMaker.id}, clock_timestamp(), ${apChecker.id}, clock_timestamp()
      ),
      (
        ${vendor3Id}, 'VEND-CYBER-003', 'PT Cyber Infratech Indonesia', '03.456.789.0-014.000', TRUE, 'BLACKLISTED',
        ${apMaker.id}, NULL, NULL, NULL, NULL
      )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      is_pkp = EXCLUDED.is_pkp
  `;

  const bank1Id = '30000000-0000-0000-0000-000000000001';
  const bank2Id = '30000000-0000-0000-0000-000000000002';
  const bank3Id = '30000000-0000-0000-0000-000000000003';

  await sql`
    INSERT INTO vendor_bank_account (
      id, vendor_id, bank_name, bank_code, account_number_encrypted,
      account_number_masked, account_holder_name, status,
      verified_by_1, verified_at_1, verified_by_2, verified_at_2, is_primary
    ) VALUES 
      (
        ${bank1Id}, ${vendor1Id}, 'BCA', '014', 'enc_1234567890',
        '******7890', 'PT Fiber Optik Nusantara', 'VERIFIED',
        ${apMaker.id}, clock_timestamp(), ${apChecker.id}, clock_timestamp(), TRUE
      ),
      (
        ${bank2Id}, ${vendor2Id}, 'Mandiri', '008', 'enc_1020030040',
        '******0040', 'PT Mitra Solusi Jaringan', 'VERIFIED',
        ${apMaker.id}, clock_timestamp(), ${apChecker.id}, clock_timestamp(), TRUE
      ),
      (
        ${bank3Id}, ${vendor3Id}, 'BCA', '014', 'enc_5566778899',
        '******8899', 'PT Cyber Infratech Indonesia', 'VERIFIED',
        ${apMaker.id}, clock_timestamp(), ${apChecker.id}, clock_timestamp(), TRUE
      )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      is_primary = EXCLUDED.is_primary
  `;

  console.log('[Seed] Seeding active procurement transactions (PR, PO, BAST, Invoice, Payment)...');
  const requester = DEMO_PERSONAS.find((p) => p.role === 'REQUESTER')!;
  const approver = DEMO_PERSONAS.find((p) => p.role === 'APPROVER')!;
  const warehouse = DEMO_PERSONAS.find((p) => p.role === 'WAREHOUSE')!;

  const pr1Id = '40000000-0000-0000-0000-000000000001';
  const pr2Id = '40000000-0000-0000-0000-000000000002';
  const pr3Id = '40000000-0000-0000-0000-000000000003';
  const pr3ItemId = '41000000-0000-0000-0000-000000000001';

  await sql`
    INSERT INTO purchase_request (
      id, pr_number, requester_id, cost_center, division_id, branch_id,
      required_date, payment_term_type, status, business_justification, total_estimated_amount
    ) VALUES 
      (
        ${pr1Id}, 'PR-202608-0001', ${requester.id}, 'CC-IT-OPS', 'DIV-IT', 'HQ_MEDAN',
        CURRENT_DATE + 14, 'PAY_AFTER_RECEIPT', 'DRAFT',
        'Pengadaan Patch Cord Fiber Optik untuk Maintenance POP Medan', 15000000
      ),
      (
        ${pr2Id}, 'PR-202608-0002', ${requester.id}, 'CC-IT-OPS', 'DIV-IT', 'HQ_MEDAN',
        CURRENT_DATE + 7, 'PAY_AFTER_RECEIPT', 'SUBMITTED',
        'Pengadaan SFP+ 10G Transceiver untuk upgrade uplink BTS Belawan', 25000000
      ),
      (
        ${pr3Id}, 'PR-202608-0003', ${requester.id}, 'CC-IT-INFRA', 'DIV-IT', 'HQ_MEDAN',
        CURRENT_DATE + 3, 'PAY_AFTER_RECEIPT', 'APPROVED',
        'Pengadaan 10 unit Core Edge Router untuk upgrade backbone POP Nusanet', 50000000
      )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      total_estimated_amount = EXCLUDED.total_estimated_amount
  `;

  await sql`
    INSERT INTO purchase_request_item (
      id, pr_id, line_number, item_name, specification, quantity_requested, uom, estimated_unit_price
    ) VALUES 
      (
        ${pr3ItemId}, ${pr3Id}, 1, 'Core Edge Router 10G', 'Dual Power Supply, 10Gbps SFP+ Ports',
        10, 'Unit', 5000000
      )
    ON CONFLICT (id) DO UPDATE SET
      item_name = EXCLUDED.item_name,
      estimated_unit_price = EXCLUDED.estimated_unit_price
  `;

  // Approval step for PR 2
  await sql`
    INSERT INTO approval_instance (
      pr_id, step_order, assigned_role, assigned_user_id, decision
    ) VALUES 
      (${pr2Id}, 1, 'APPROVER', ${approver.id}, 'PENDING')
    ON CONFLICT (pr_id, step_order) DO UPDATE SET
      decision = EXCLUDED.decision
  `;

  // PO 1
  const po1Id = '50000000-0000-0000-0000-000000000001';
  const po1ItemId = '51000000-0000-0000-0000-000000000001';

  await sql`
    INSERT INTO purchase_order (
      id, po_number, vendor_id, vendor_bank_account_id, payment_term_type,
      version_number, status, subtotal_amount, tax_amount, grand_total_amount,
      terms_and_conditions, created_by, approved_by, approved_at, issued_at
    ) VALUES (
      ${po1Id}, 'PO-202608-0001', ${vendor1Id}, ${bank1Id}, 'PAY_AFTER_RECEIPT',
      1, 'ISSUED', 50000000, 6000000, 56000000,
      'Termin pembayaran Net 30 hari setelah barang diterima lengkap dan BAST diverifikasi.',
      ${apMaker.id}, ${apChecker.id}, clock_timestamp(), clock_timestamp()
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      grand_total_amount = EXCLUDED.grand_total_amount
  `;

  await sql`
    INSERT INTO purchase_order_item (
      id, po_id, pr_item_id, line_number, item_name, quantity_ordered,
      quantity_received, quantity_invoiced, uom, unit_price
    ) VALUES (
      ${po1ItemId}, ${po1Id}, ${pr3ItemId}, 1, 'Core Edge Router 10G',
      10, 5, 5, 'Unit', 5000000
    )
    ON CONFLICT (id) DO UPDATE SET
      quantity_received = EXCLUDED.quantity_received,
      quantity_invoiced = EXCLUDED.quantity_invoiced
  `;

  // BAST 1 (Partial Goods Receipt)
  const gr1Id = '60000000-0000-0000-0000-000000000001';
  const gr1ItemId = '61000000-0000-0000-0000-000000000001';

  await sql`
    INSERT INTO goods_receipt (
      id, gr_number, po_id, receipt_type, delivery_note_number,
      received_date, received_by, notes
    ) VALUES (
      ${gr1Id}, 'GR-202608-0001', ${po1Id}, 'WAREHOUSE', 'SJ-FIBER-99120',
      CURRENT_DATE, ${warehouse.id}, 'Penerimaan tahap 1 sebanyak 5 unit router dalam kondisi baik dan tersegel.'
    )
    ON CONFLICT (id) DO UPDATE SET
      receipt_type = EXCLUDED.receipt_type,
      notes = EXCLUDED.notes
  `;

  await sql`
    INSERT INTO goods_receipt_item (
      id, gr_id, po_item_id, quantity_received, quantity_rejected, condition_notes
    ) VALUES (
      ${gr1ItemId}, ${gr1Id}, ${po1ItemId}, 5, 0, 'Kondisi mulus, lolos uji powering'
    )
    ON CONFLICT (id) DO NOTHING
  `;

  // Invoice 1 (MATCHED_WITH_EXCEPTION for 2-Way Matcher demo)
  const inv1Id = '70000000-0000-0000-0000-000000000001';
  const taxSnapshotId = '00000000-0000-0000-0000-000000000001';

  await sql`
    INSERT INTO invoice (
      id, invoice_number_internal, vendor_invoice_number, vendor_invoice_normalized,
      vendor_id, po_id, gr_id, invoice_type, invoice_date, due_date,
      subtotal_amount, ppn_amount, pph_amount, total_payable_amount,
      nsfp_original, nsfp_normalized, is_nsfp_valid, tax_snapshot_id,
      match_status, is_held_for_tax, uploaded_by
    ) VALUES (
      ${inv1Id}, 'INV-INT-202608-0001', 'INV-2026-FIBER-01', 'INV2026FIBER01',
      ${vendor1Id}, ${po1Id}, ${gr1Id}, 'STANDARD', CURRENT_DATE, CURRENT_DATE + 30,
      26000000, 3120000, 0, 29120000,
      '010.001-26.99887766', '0100012699887766', TRUE, ${taxSnapshotId},
      'MATCHED_WITH_EXCEPTION', FALSE, ${apMaker.id}
    )
    ON CONFLICT (id) DO UPDATE SET
      match_status = EXCLUDED.match_status,
      total_payable_amount = EXCLUDED.total_payable_amount
  `;

  const excId = '71000000-0000-0000-0000-000000000001';
  await sql`
    INSERT INTO invoice_matching_exception (
      id, invoice_id, exception_code, description, variance_amount, variance_percentage, is_overridden
    ) VALUES (
      ${excId}, ${inv1Id}, 'PRICE_VARIANCE_WARNING',
      'Terdapat selisih harga unit sebesar Rp 1.000.000 (biaya asuransi transit) yang memerlukan persetujuan Head of AP.',
      1000000, 3.85, FALSE
    )
    ON CONFLICT (id) DO NOTHING
  `;

  // Payment Proposal 1 (CHECKED status ready for execution)
  const prop1Id = '80000000-0000-0000-0000-000000000001';
  const alloc1Id = '81000000-0000-0000-0000-000000000001';

  await sql`
    INSERT INTO payment_proposal (
      id, proposal_number, vendor_id, vendor_bank_account_id,
      total_payment_amount, payment_method, status,
      proposed_by, checked_by, checked_at
    ) VALUES (
      ${prop1Id}, 'PROP-202608-0001', ${vendor1Id}, ${bank1Id},
      29120000, 'BANK_TRANSFER', 'CHECKED',
      ${apMaker.id}, ${apChecker.id}, clock_timestamp()
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      total_payment_amount = EXCLUDED.total_payment_amount
  `;

  await sql`
    INSERT INTO payment_invoice_allocation (
      id, payment_proposal_id, invoice_id, allocated_amount, is_advance_payment
    ) VALUES (
      ${alloc1Id}, ${prop1Id}, ${inv1Id}, 29120000, FALSE
    )
    ON CONFLICT (id) DO NOTHING
  `;

  console.log('[Seed] Database seeding completed successfully! ✨');
  return { success: true, message: 'Seeder completed successfully with realistic PT Nusanet data.' };
}

if (import.meta.main) {
  runSeed()
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Error during seeding:', err);
      process.exit(1);
    });
}
