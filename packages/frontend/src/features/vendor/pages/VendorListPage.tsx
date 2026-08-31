import React, { useState } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Card,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  App,
  theme,
  type TableProps,
} from 'antd';
import {
  ShopOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  BankOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { vendorApi, type CreateVendorPayload, type CreateBankAccountPayload } from '../../../api/endpoints/vendor';
import { useAuthStore } from '../../../stores/useAuthStore';
import { PageHeader } from '../../../components/common/PageHeader';
import { StatusTag } from '../../../components/common/StatusTag';

const { Text } = Typography;

export interface VendorDisplayItem {
  id: string;
  vendorCode: string;
  name: string;
  taxIdentificationNumber: string;
  isPkp: boolean;
  status: 'PROSPECTIVE' | 'APPROVED' | 'SUSPENDED' | 'BLACKLISTED';
  bankAccounts?: Array<{
    id: string;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountHolderName: string;
    status: 'PENDING_STAGE_1' | 'PENDING_STAGE_2' | 'ACTIVE' | 'REJECTED';
    approvedBy1?: string | null;
    approvedBy2?: string | null;
  }>;
}

const DEFAULT_VENDORS: VendorDisplayItem[] = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    vendorCode: 'VEND-FIBER-001',
    name: 'PT Fiber Optik Nusantara',
    taxIdentificationNumber: '01.234.567.8-012.000',
    isPkp: true,
    status: 'APPROVED',
    bankAccounts: [
      {
        id: 'ba-001',
        bankName: 'BCA',
        bankCode: '014',
        accountNumber: '••••••••890',
        accountHolderName: 'PT Fiber Optik Nusantara',
        status: 'ACTIVE',
        approvedBy1: 'AP Maker',
        approvedBy2: 'Head of AP',
      },
    ],
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    vendorCode: 'VEND-MITRA-002',
    name: 'PT Mitra Solusi Jaringan',
    taxIdentificationNumber: '02.345.678.9-013.000',
    isPkp: true,
    status: 'APPROVED',
    bankAccounts: [
      {
        id: 'ba-002',
        bankName: 'Mandiri',
        bankCode: '008',
        accountNumber: '••••••••040',
        accountHolderName: 'PT Mitra Solusi Jaringan',
        status: 'PENDING_STAGE_2',
        approvedBy1: 'AP Maker',
      },
    ],
  },
  {
    id: '20000000-0000-0000-0000-000000000003',
    vendorCode: 'VEND-CYBER-003',
    name: 'PT Cyber Infratech Indonesia',
    taxIdentificationNumber: '03.456.789.0-014.000',
    isPkp: false,
    status: 'BLACKLISTED',
    bankAccounts: [
      {
        id: 'ba-003',
        bankName: 'BCA',
        bankCode: '014',
        accountNumber: '••••••••899',
        accountHolderName: 'PT Cyber Infratech Indonesia',
        status: 'ACTIVE',
      },
    ],
  },
];

export const VendorListPage: React.FC = () => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { user } = useAuthStore();
  const [vendors, setVendors] = useState<VendorDisplayItem[]>(DEFAULT_VENDORS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  // Modals
  const [isCreateVendorOpen, setIsCreateVendorOpen] = useState(false);
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);
  const [isVerifyBankOpen, setIsVerifyBankOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorDisplayItem | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

  const [createVendorForm] = Form.useForm<CreateVendorPayload>();
  const [addBankForm] = Form.useForm<CreateBankAccountPayload>();
  const [verifyBankForm] = Form.useForm<{ action: 'VERIFY_STAGE_1' | 'VERIFY_STAGE_2' | 'REJECT'; rejectionReason?: string }>();

  const createVendorMutation = useMutation({
    mutationFn: (payload: CreateVendorPayload) => vendorApi.create(payload),
    onSuccess: (res, variables) => {
      message.success('Master Vendor baru berhasil didaftarkan.');
      setVendors((prev) => [
        {
          id: res?.data?.id || `vendor-${Date.now()}`,
          vendorCode: variables.vendorCode || `VEND-${Date.now().toString().slice(-4)}`,
          name: variables.name,
          taxIdentificationNumber: variables.taxIdentificationNumber,
          isPkp: !!variables.isPkp,
          status: 'APPROVED',
          bankAccounts: [],
        },
        ...prev,
      ]);
      setIsCreateVendorOpen(false);
      createVendorForm.resetFields();
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal mendaftarkan vendor');
    },
  });

  const addBankMutation = useMutation({
    mutationFn: ({ vendorId, payload }: { vendorId: string; payload: CreateBankAccountPayload }) =>
      vendorApi.createBankAccount(vendorId, payload),
    onSuccess: (_, { vendorId, payload }) => {
      message.success('Rekening bank vendor berhasil ditambahkan dan masuk antrean verifikasi Stage 1.');
      setVendors((prev) =>
        prev.map((v) => {
          if (v.id === vendorId) {
            const accounts = v.bankAccounts || [];
            return {
              ...v,
              bankAccounts: [
                ...accounts,
                {
                  id: `bank-${Date.now()}`,
                  bankName: payload.bankName,
                  bankCode: payload.bankCode,
                  accountNumber: `••••••••${payload.accountNumber.slice(-4)}`,
                  accountHolderName: payload.accountHolderName,
                  status: 'PENDING_STAGE_1',
                },
              ],
            };
          }
          return v;
        })
      );
      setIsAddBankOpen(false);
      addBankForm.resetFields();
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal menambahkan rekening');
    },
  });

  const verifyBankMutation = useMutation({
    mutationFn: ({
      vendorId,
      bankId,
      payload,
    }: {
      vendorId: string;
      bankId: string;
      payload: { action: 'VERIFY_STAGE_1' | 'VERIFY_STAGE_2' | 'REJECT'; rejectionReason?: string };
    }) => vendorApi.verifyBankAccount(vendorId, bankId, payload),
    onSuccess: (_, { vendorId, bankId, payload }) => {
      message.success(`Verifikasi rekening 4-Eyes (${payload.action}) berhasil dicatat.`);
      setVendors((prev) =>
        prev.map((v) => {
          if (v.id === vendorId) {
            return {
              ...v,
              bankAccounts: (v.bankAccounts || []).map((b) => {
                if (b.id === bankId) {
                  const nextStatus =
                    payload.action === 'VERIFY_STAGE_1'
                      ? 'PENDING_STAGE_2'
                      : payload.action === 'VERIFY_STAGE_2'
                      ? 'ACTIVE'
                      : 'REJECTED';
                  return {
                    ...b,
                    status: nextStatus as any,
                    approvedBy1: payload.action === 'VERIFY_STAGE_1' ? user?.fullName || 'Verifier 1' : b.approvedBy1,
                    approvedBy2: payload.action === 'VERIFY_STAGE_2' ? user?.fullName || 'Verifier 2' : b.approvedBy2,
                  };
                }
                return b;
              }),
            };
          }
          return v;
        })
      );
      setIsVerifyBankOpen(false);
      verifyBankForm.resetFields();
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal memverifikasi rekening');
    },
  });

  const filteredVendors = vendors.filter((v) => {
    if (statusFilter && v.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        v.name.toLowerCase().includes(term) ||
        v.vendorCode.toLowerCase().includes(term) ||
        v.taxIdentificationNumber.includes(term)
      );
    }
    return true;
  });

  const columns: TableProps<VendorDisplayItem>['columns'] = [
    {
      title: 'Kode Vendor',
      dataIndex: 'vendorCode',
      key: 'vendorCode',
      render: (code: string) => (
        <Tag color="geekblue" style={{ fontWeight: 600 }}>
          {code}
        </Tag>
      ),
    },
    {
      title: 'Nama Perusahaan Vendor',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'NPWP (Tax ID)',
      dataIndex: 'taxIdentificationNumber',
      key: 'taxIdentificationNumber',
      render: (npwp: string) => <Text copyable>{npwp}</Text>,
    },
    {
      title: 'Status PKP',
      dataIndex: 'isPkp',
      key: 'isPkp',
      render: (isPkp: boolean) =>
        isPkp ? <Tag color="success">PKP</Tag> : <Tag color="default">Non-PKP</Tag>,
    },
    {
      title: 'Status Vendor',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => <StatusTag status={st} />,
    },
    {
      title: 'Rekening Bank Terdaftar & Verifikasi 4-Eyes (R17, R18)',
      key: 'bankAccounts',
      render: (_, r) => {
        const accounts = r.bankAccounts || [];
        if (accounts.length === 0) {
          return <Text type="secondary">Belum ada rekening</Text>;
        }
        return (
          <Space direction="vertical" size={4}>
            {accounts.map((b) => {
              const statusColor =
                b.status === 'ACTIVE'
                  ? 'success'
                  : b.status === 'REJECTED'
                  ? 'error'
                  : 'warning';
              return (
                <div key={b.id} style={{ fontSize: 12, lineHeight: 1.4 }}>
                  <Space size={6}>
                    <BankOutlined />
                    <Text strong>{b.bankName}</Text>
                    <span>({b.accountNumber})</span>
                    <Tag color={statusColor} style={{ fontSize: 10, padding: '0 4px' }}>
                      {b.status === 'ACTIVE'
                        ? 'Terverifikasi (Active)'
                        : b.status === 'PENDING_STAGE_1'
                        ? 'Menunggu Verifikasi 1'
                        : b.status === 'PENDING_STAGE_2'
                        ? 'Menunggu Verifikasi 2'
                        : 'Ditolak'}
                    </Tag>
                  </Space>
                  {b.status.startsWith('PENDING') && (
                    <Button
                      type="link"
                      size="small"
                      icon={<SafetyCertificateOutlined />}
                      style={{ padding: '0 4px', fontSize: 11 }}
                      onClick={() => {
                        setSelectedVendor(r);
                        setSelectedBankId(b.id);
                        verifyBankForm.setFieldsValue({
                          action: b.status === 'PENDING_STAGE_1' ? 'VERIFY_STAGE_1' : 'VERIFY_STAGE_2',
                        });
                        setIsVerifyBankOpen(true);
                      }}
                    >
                      Verifikasi 4-Eyes
                    </Button>
                  )}
                </div>
              );
            })}
          </Space>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      render: (_, r) => (
        <Space size="small">
          <Button
            size="small"
            icon={<BankOutlined />}
            onClick={() => {
              setSelectedVendor(r);
              setIsAddBankOpen(true);
            }}
          >
            + Rekening
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Master Vendor & Rekening Bank (4-Eyes Principle R17–R19)"
        subtitle="Katalog vendor resmi, status PKP, dan kepatuhan verifikasi rekening ganda (4-Eyes Principle) untuk mencegah Fraudulent Bank Modification."
        icon={<ShopOutlined style={{ color: token.colorPrimary }} />}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateVendorOpen(true)}
          >
            Tambah Vendor Baru
          </Button>
        }
      />

      <Card>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Cari kode vendor, nama perusahaan, NPWP..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Filter Status Vendor"
              style={{ width: '100%' }}
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Select.Option value="APPROVED">Disetujui (Approved)</Select.Option>
              <Select.Option value="PROSPECTIVE">Prospektif</Select.Option>
              <Select.Option value="SUSPENDED">Ditangguhkan</Select.Option>
              <Select.Option value="BLACKLISTED">Blacklist</Select.Option>
            </Select>
          </Col>
        </Row>

        <Table<VendorDisplayItem>
          columns={columns}
          dataSource={filteredVendors}
          rowKey="id"
          scroll={{ x: 850 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Modal: Tambah Vendor */}
      <Modal
        title="Daftarkan Master Vendor Baru"
        open={isCreateVendorOpen}
        onCancel={() => {
          setIsCreateVendorOpen(false);
          createVendorForm.resetFields();
        }}
        onOk={() => createVendorForm.submit()}
        confirmLoading={createVendorMutation.isPending}
        okText="Simpan Vendor"
        cancelText="Batal"
      >
        <Form
          form={createVendorForm}
          layout="vertical"
          onFinish={(val) => createVendorMutation.mutate(val)}
          initialValues={{ isPkp: true }}
        >
          <Form.Item
            name="name"
            label="Nama Perusahaan Vendor"
            rules={[{ required: true, message: 'Nama perusahaan vendor wajib diisi' }]}
          >
            <Input placeholder="Contoh: PT Solusi Jaringan Global" />
          </Form.Item>

          <Form.Item name="vendorCode" label="Kode Vendor (Opsional)">
            <Input placeholder="Contoh: VEND-GLOBAL-004" />
          </Form.Item>

          <Form.Item
            name="taxIdentificationNumber"
            label="Nomor Pokok Wajib Pajak (NPWP)"
            rules={[{ required: true, message: 'NPWP wajib diisi' }]}
          >
            <Input placeholder="Contoh: 01.234.567.8-012.000" />
          </Form.Item>

          <Form.Item name="isPkp" label="Status Pengusaha Kena Pajak (PKP)" valuePropName="checked">
            <Select>
              <Select.Option value={true}>Ya (PKP — Menerbitkan Faktur Pajak)</Select.Option>
              <Select.Option value={false}>Bukan PKP</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Tambah Rekening Bank */}
      <Modal
        title={`Tambah Rekening Bank: ${selectedVendor?.name || ''}`}
        open={isAddBankOpen}
        onCancel={() => {
          setIsAddBankOpen(false);
          addBankForm.resetFields();
        }}
        onOk={() => addBankForm.submit()}
        confirmLoading={addBankMutation.isPending}
        okText="Daftarkan Rekening"
        cancelText="Batal"
      >
        <Form
          form={addBankForm}
          layout="vertical"
          onFinish={(val) => {
            if (selectedVendor) {
              addBankMutation.mutate({ vendorId: selectedVendor.id, payload: val });
            }
          }}
        >
          <Form.Item
            name="bankName"
            label="Nama Bank"
            rules={[{ required: true, message: 'Nama bank wajib diisi' }]}
          >
            <Select placeholder="Pilih Bank">
              <Select.Option value="BCA">Bank Central Asia (BCA)</Select.Option>
              <Select.Option value="Mandiri">Bank Mandiri</Select.Option>
              <Select.Option value="BNI">Bank Negara Indonesia (BNI)</Select.Option>
              <Select.Option value="BRI">Bank Rakyat Indonesia (BRI)</Select.Option>
              <Select.Option value="CIMB">CIMB Niaga</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="bankCode"
            label="Kode Kliring BI / Bank Code"
            rules={[{ required: true, message: 'Kode bank wajib diisi' }]}
            initialValue="014"
          >
            <Input placeholder="Contoh: 014" />
          </Form.Item>

          <Form.Item
            name="accountNumber"
            label="Nomor Rekening"
            rules={[{ required: true, message: 'Nomor rekening wajib diisi' }]}
          >
            <Input placeholder="Contoh: 1234567890" />
          </Form.Item>

          <Form.Item
            name="accountHolderName"
            label="Nama Pemilik Rekening (Sesuai Buku Tabungan)"
            rules={[{ required: true, message: 'Nama pemilik rekening wajib diisi' }]}
          >
            <Input placeholder="Contoh: PT Solusi Jaringan Global" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Verifikasi Rekening 4-Eyes (R18) */}
      <Modal
        title="Verifikasi Rekening Bank (4-Eyes Principle - R18)"
        open={isVerifyBankOpen}
        onCancel={() => {
          setIsVerifyBankOpen(false);
          verifyBankForm.resetFields();
        }}
        onOk={() => verifyBankForm.submit()}
        confirmLoading={verifyBankMutation.isPending}
        okText="Konfirmasi Verifikasi"
        cancelText="Batal"
      >
        <Form
          form={verifyBankForm}
          layout="vertical"
          onFinish={(val) => {
            if (selectedVendor && selectedBankId) {
              verifyBankMutation.mutate({
                vendorId: selectedVendor.id,
                bankId: selectedBankId,
                payload: val,
              });
            }
          }}
        >
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Setiap rekening bank vendor baru wajib diverifikasi secara independen oleh dua orang petugas terpisah (Stage 1 AP Staff & Stage 2 Head of AP) sebelum dapat digunakan untuk transfer dana.
          </Text>

          <Form.Item name="action" label="Tindakan Verifikasi" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="VERIFY_STAGE_1">Verifikasi Tahap 1 (AP Staff)</Select.Option>
              <Select.Option value="VERIFY_STAGE_2">Verifikasi Tahap 2 (Head of AP - Final Rilis)</Select.Option>
              <Select.Option value="REJECT">Tolak Rekening</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="rejectionReason" label="Catatan / Alasan Penolakan (Jika ditolak)">
            <Input.TextArea rows={3} placeholder="Contoh: Nama di rekening tidak cocok dengan NPWP" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default VendorListPage;
