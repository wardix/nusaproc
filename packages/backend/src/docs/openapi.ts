export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'NusaProc Enterprise Procurement Platform REST API',
    version: '1.0.0',
    description: `
**NusaProc Enterprise Procurement API Specification**

NusaProc is an enterprise-grade, multi-actor procurement governance platform engineered for PT Nusanet.
Features include:
- **5-Layer Security & Separation of Duties (SoD)** with dynamic step-up re-authentication (R5, R43).
- **Multi-Item Purchase Request Management** with payment term constraints (R6–R16).
- **Dual-Stage 4-Eyes Vendor Bank Account Verification** (R17–R19).
- **Purchase Order Issuance, SoD Approval & PDF Engine** (R20–R27).
- **Warehouse & Direct Requester Goods Receipt (BAST)** (R28–R32).
- **Dual-NSFP Invoice Tax Compliance & Automated 2-Way Matching Engine** (R33–R40).
- **Maker-Checker-Executor Payment Proposal & Idempotent Bank Transfer Execution** (R41–R45).
- **Append-Only SHA-256 Hash Chained Audit Trail & Auditor Sandbox** (R51–R55).
- **Webhook Dispatcher with HMAC-SHA256 Signatures & Delegation Lifecycle** (R61–R65).
    `,
    contact: {
      name: 'NusaProc Engineering Team',
      email: 'dev@nusanet.net.id',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 Base Endpoint',
    },
    {
      url: '/',
      description: 'Root Server Endpoint',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Standard session JWT token',
      },
      UserIdHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-User-Id',
        description: 'Authenticated User ID UUID',
      },
      UserRoleHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-User-Role',
        description: 'Active User Role (REQUESTER, APPROVER, ACCOUNT_PAYABLE, WAREHOUSE, FINANCE, AUDITOR, ADMIN)',
      },
      ReauthTokenHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Reauth-Token',
        description: 'Short-lived purpose-bound Step-Up Re-Authentication token (R5, R43)',
      },
    },
    schemas: {
      ProblemDetails: {
        type: 'object',
        properties: {
          type: { type: 'string', example: 'https://nusaproc.nusanet.net.id/errors/sod-conflict' },
          title: { type: 'string', example: 'Separation of Duties Conflict' },
          status: { type: 'integer', example: 409 },
          detail: { type: 'string', example: 'Pengguna yang sama tidak dapat menyetujui PO yang dibuat sendiri (R25).' },
          instance: { type: 'string', example: '/api/v1/purchase-orders/50000000-0000-0000-0000-000000000001/approve' },
          code: { type: 'string', example: 'R25_PO_SOD_CONFLICT' },
        },
      },
      PurchaseRequest: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          prNumber: { type: 'string', example: 'PR-202608-0001' },
          requesterId: { type: 'string', format: 'uuid' },
          costCenter: { type: 'string', example: 'CC-IT-INFRA' },
          divisionId: { type: 'string', example: 'DIV-IT' },
          branchId: { type: 'string', example: 'HQ_MEDAN' },
          requiredDate: { type: 'string', format: 'date', example: '2026-08-30' },
          paymentTermType: { type: 'string', enum: ['ADVANCE_OR_COD', 'PAY_AFTER_RECEIPT'] },
          status: { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CLOSED_PARTIAL'] },
          businessJustification: { type: 'string' },
          totalEstimatedAmount: { type: 'number', example: 50000000 },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                lineNumber: { type: 'integer', example: 1 },
                itemName: { type: 'string', example: 'Core Edge Router 10G' },
                specification: { type: 'string' },
                quantityRequested: { type: 'number', example: 10 },
                uom: { type: 'string', example: 'Unit' },
                estimatedUnitPrice: { type: 'number', example: 5000000 },
              },
            },
          },
        },
      },
      PurchaseOrder: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          poNumber: { type: 'string', example: 'PO-202608-0001' },
          vendorId: { type: 'string', format: 'uuid' },
          vendorBankAccountId: { type: 'string', format: 'uuid' },
          paymentTermType: { type: 'string', enum: ['ADVANCE_OR_COD', 'PAY_AFTER_RECEIPT'] },
          versionNumber: { type: 'integer', example: 1 },
          status: { type: 'string', enum: ['DRAFT', 'APPROVED', 'ISSUED', 'AMENDED', 'CANCELLED'] },
          subtotalAmount: { type: 'number', example: 50000000 },
          taxAmount: { type: 'number', example: 6000000 },
          grandTotalAmount: { type: 'number', example: 56000000 },
          termsAndConditions: { type: 'string' },
        },
      },
      Vendor: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          vendorCode: { type: 'string', example: 'VEND-FIBER-001' },
          name: { type: 'string', example: 'PT Fiber Optik Nusantara' },
          taxIdentificationNumber: { type: 'string', example: '01.234.567.8-012.000' },
          isPkp: { type: 'boolean', example: true },
          status: { type: 'string', enum: ['PROSPECTIVE', 'APPROVED', 'BLACKLISTED', 'SUSPENDED'] },
        },
      },
      GoodsReceipt: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          grNumber: { type: 'string', example: 'GR-202608-0001' },
          poId: { type: 'string', format: 'uuid' },
          receiptType: { type: 'string', enum: ['DIRECT_REQUESTER', 'WAREHOUSE'] },
          deliveryNoteNumber: { type: 'string', example: 'SJ-NUSA-20260824' },
          receivedDate: { type: 'string', format: 'date', example: '2026-08-24' },
          notes: { type: 'string' },
        },
      },
      Invoice: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          invoiceNumberInternal: { type: 'string', example: 'INV-INT-202608-0001' },
          vendorInvoiceNumber: { type: 'string', example: 'INV-2026-001' },
          vendorId: { type: 'string', format: 'uuid' },
          poId: { type: 'string', format: 'uuid' },
          grId: { type: 'string', format: 'uuid' },
          subtotalAmount: { type: 'number', example: 50000000 },
          ppnAmount: { type: 'number', example: 6000000 },
          totalPayableAmount: { type: 'number', example: 56000000 },
          nsfpOriginal: { type: 'string', example: '010.001-26.98765432' },
          matchStatus: { type: 'string', enum: ['UNMATCHED', 'MATCHED_OK', 'MATCHED_WITH_EXCEPTION', 'EXCEPTION_OVERRIDDEN'] },
        },
      },
      PaymentProposal: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          proposalNumber: { type: 'string', example: 'PROP-202608-0001' },
          vendorId: { type: 'string', format: 'uuid' },
          vendorBankAccountId: { type: 'string', format: 'uuid' },
          totalPaymentAmount: { type: 'number', example: 56000000 },
          paymentMethod: { type: 'string', example: 'BANK_TRANSFER' },
          status: { type: 'string', enum: ['PROPOSED', 'CHECKED', 'EXECUTED', 'REJECTED'] },
        },
      },
    },
  },
  security: [
    {
      UserIdHeader: [],
      UserRoleHeader: [],
    },
  ],
  paths: {
    '/purchase-requests': {
      get: {
        summary: 'List Purchase Requests',
        description: 'Retrieve filtered list of purchase requests (R6–R12).',
        tags: ['Purchase Request'],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'requesterId', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'List of PR records retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/PurchaseRequest' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create Purchase Request',
        description: 'Create a new multi-item Purchase Request (R6, R7, R8).',
        tags: ['Purchase Request'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['costCenter', 'divisionId', 'branchId', 'requiredDate', 'paymentTermType', 'businessJustification', 'items'],
                properties: {
                  costCenter: { type: 'string', example: 'CC-IT-OPS' },
                  divisionId: { type: 'string', example: 'DIV-IT' },
                  branchId: { type: 'string', example: 'HQ_MEDAN' },
                  requiredDate: { type: 'string', format: 'date', example: '2026-08-30' },
                  paymentTermType: { type: 'string', enum: ['ADVANCE_OR_COD', 'PAY_AFTER_RECEIPT'] },
                  businessJustification: { type: 'string', example: 'Pengadaan router POP' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['itemName', 'quantityRequested', 'uom', 'estimatedUnitPrice'],
                      properties: {
                        itemName: { type: 'string', example: 'Core Edge Router 10G' },
                        specification: { type: 'string' },
                        quantityRequested: { type: 'number', example: 10 },
                        uom: { type: 'string', example: 'Unit' },
                        estimatedUnitPrice: { type: 'number', example: 5000000 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'PR created in DRAFT status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/PurchaseRequest' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/purchase-requests/{id}/submit': {
      post: {
        summary: 'Submit Purchase Request',
        description: 'Submits a DRAFT PR to trigger the approval hierarchy engine (R9, R12).',
        tags: ['Purchase Request'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'PR submitted successfully' },
        },
      },
    },
    '/purchase-requests/{id}/decide': {
      post: {
        summary: 'Approve or Reject PR',
        description: 'Approver records decision within limit thresholds (R13, R15).',
        tags: ['Purchase Request'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['decision'],
                properties: {
                  decision: { type: 'string', enum: ['APPROVED', 'REJECTED'] },
                  rejectionReason: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'PR decision recorded successfully' },
        },
      },
    },
    '/vendors': {
      get: {
        summary: 'List Vendors',
        tags: ['Vendor & Bank'],
        responses: { '200': { description: 'List of registered vendors' } },
      },
      post: {
        summary: 'Register Prospective Vendor',
        description: 'Registers a new vendor in PROSPECTIVE status (R17).',
        tags: ['Vendor & Bank'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'taxIdentificationNumber'],
                properties: {
                  name: { type: 'string', example: 'PT Fiber Optik Nusantara' },
                  taxIdentificationNumber: { type: 'string', example: '01.234.567.8-012.000' },
                  isPkp: { type: 'boolean', example: true },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Vendor created successfully' } },
      },
    },
    '/vendors/{vendorId}/bank-accounts/{bankId}/verify': {
      post: {
        summary: '4-Eyes Bank Account Verification',
        description: 'Performs Stage 1 or Stage 2 bank account verification with strict SoD enforcement (R18, R19).',
        tags: ['Vendor & Bank'],
        parameters: [
          { name: 'vendorId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'bankId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action'],
                properties: {
                  action: { type: 'string', enum: ['VERIFY_STAGE_1', 'VERIFY_STAGE_2', 'REJECT'] },
                  rejectionReason: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Bank account verification stage processed' } },
      },
    },
    '/purchase-orders': {
      post: {
        summary: 'Create Purchase Order',
        description: 'Creates a Purchase Order linked to approved PR items (R20, R24).',
        tags: ['Purchase Order'],
        responses: { '201': { description: 'PO created in DRAFT status' } },
      },
    },
    '/purchase-orders/{id}/issue': {
      post: {
        summary: 'Issue Purchase Order',
        description: 'Officially issues PO to verified vendor (R24).',
        tags: ['Purchase Order'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'PO issued successfully' } },
      },
    },
    '/purchase-orders/{id}/pdf': {
      get: {
        summary: 'Download PO PDF Document',
        description: 'Generates official printable PDF buffer for issued PO (R27).',
        tags: ['Purchase Order'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': {
            description: 'Binary PDF document stream',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
        },
      },
    },
    '/receipts': {
      get: {
        summary: 'List Goods Receipts (BAST)',
        tags: ['Receipt & BAST'],
        responses: { '200': { description: 'List of BAST records' } },
      },
      post: {
        summary: 'Record Goods Receipt (BAST)',
        description: 'Warehouse or Requester records receipt with item condition inspection (R28, R29, R31).',
        tags: ['Receipt & BAST'],
        responses: { '201': { description: 'Goods receipt recorded' } },
      },
    },
    '/invoices': {
      get: {
        summary: 'List Invoices',
        tags: ['Invoice & Matching'],
        responses: { '200': { description: 'List of vendor invoices' } },
      },
      post: {
        summary: 'Create Vendor Invoice',
        description: 'Records invoice with NSFP and Tax Snapshot (R33–R36).',
        tags: ['Invoice & Matching'],
        responses: { '201': { description: 'Invoice recorded' } },
      },
    },
    '/invoices/{id}/match': {
      post: {
        summary: 'Run 2-Way Matcher',
        description: 'Executes automated 2-Way Matching engine against PO and BAST (R37, R38).',
        tags: ['Invoice & Matching'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Matching evaluated successfully' } },
      },
    },
    '/invoices/{id}/override': {
      post: {
        summary: 'Head of AP Exception Override',
        description: 'Head of AP overrides tolerance variance exception with mandatory memo (R39).',
        tags: ['Invoice & Matching'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Exception overridden' } },
      },
    },
    '/payments/proposals': {
      get: {
        summary: 'List Payment Proposals',
        tags: ['Payment & Treasury'],
        responses: { '200': { description: 'List of payment proposals' } },
      },
      post: {
        summary: 'Propose Payment Allocation',
        description: 'Finance Maker proposes invoice payment (R41, R42).',
        tags: ['Payment & Treasury'],
        responses: { '201': { description: 'Proposal created in PROPOSED status' } },
      },
    },
    '/payments/proposals/{id}/check': {
      post: {
        summary: 'Check Payment Proposal',
        description: 'Finance Checker reviews proposal (R42).',
        tags: ['Payment & Treasury'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Proposal checked' } },
      },
    },
    '/payments/proposals/{id}/execute': {
      post: {
        summary: 'Execute Bank Transfer',
        description: 'Finance Executor executes payment with Step-Up Re-Auth token & Idempotency Key (R5, R43).',
        tags: ['Payment & Treasury'],
        security: [{ ReauthTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Payment transfer executed idempotently' } },
      },
    },
    '/audit/verify-chain': {
      get: {
        summary: 'Verify Cryptographic Audit Hash Chain',
        description: 'Verifies SHA-256 hash chaining integrity across all audit records (R53).',
        tags: ['Audit & Compliance'],
        responses: { '200': { description: 'Hash chain integrity verified' } },
      },
    },
    '/audit/evidence-bundle': {
      get: {
        summary: 'Export Legal Evidence Bundle (ZIP)',
        description: 'Exports audit bundle ZIP for legal/audit compliance (R55).',
        tags: ['Audit & Compliance'],
        responses: {
          '200': {
            description: 'ZIP bundle binary stream',
            content: { 'application/zip': { schema: { type: 'string', format: 'binary' } } },
          },
        },
      },
    },
  },
};
