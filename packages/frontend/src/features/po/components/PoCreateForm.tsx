import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Card,
  Table,
  Space,
  Row,
  Col,
  Typography,
  Divider,
  App,
  theme,
  Tag,
  Alert,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  BankOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { poApi, type CreatePoPayload } from '../../../api/endpoints/po';
import { prApi } from '../../../api/endpoints/pr';
import { vendorApi } from '../../../api/endpoints/vendor';
import { PageHeader } from '../../../components/common/PageHeader';
import { formatRupiah } from '../../../utils/currency';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface VendorOption {
  id: string;
  name: string;
  vendorCode: string;
  status: string;
  bankAccounts?: Array<{
    id: string;
    bankName: string;
    accountNumberMasked?: string;
    accountHolderName?: string;
    status: string;
  }>;
}

const DEFAULT_VENDORS: VendorOption[] = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    name: 'PT Fiber Optik Nusantara',
    vendorCode: 'VEND-FIBER-001',
    status: 'APPROVED',
    bankAccounts: [
      {
        id: '30000000-0000-0000-0000-000000000001',
        bankName: 'BCA',
        accountNumberMasked: '******7890',
        accountHolderName: 'PT Fiber Optik Nusantara',
        status: 'VERIFIED',
      },
    ],
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    name: 'PT Mitra Solusi Jaringan',
    vendorCode: 'VEND-MITRA-002',
    status: 'APPROVED',
    bankAccounts: [
      {
        id: '30000000-0000-0000-0000-000000000002',
        bankName: 'Mandiri',
        accountNumberMasked: '******0040',
        accountHolderName: 'PT Mitra Solusi Jaringan',
        status: 'VERIFIED',
      },
    ],
  },
];

interface PoItemRow {
  key: string;
  prItemId: string;
  itemName: string;
  quantityOrdered: number;
  uom: string;
  unitPrice: number;
}

export const PoCreateForm: React.FC = () => {
  const { notification } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPrId = searchParams.get('prId') || '';

  const [form] = Form.useForm();
  const [approvedPrs, setApprovedPrs] = useState<any[]>([]);
  const [selectedPrId, setSelectedPrId] = useState<string>(initialPrId);
  const [vendors, setVendors] = useState<VendorOption[]>(DEFAULT_VENDORS);
  const [selectedVendorId, setSelectedVendorId] = useState<string>(DEFAULT_VENDORS[0].id);
  const [items, setItems] = useState<PoItemRow[]>([
    {
      key: '1',
      prItemId: '41000000-0000-0000-0000-000000000001',
      itemName: 'Core Edge Router 10G',
      quantityOrdered: 2,
      uom: 'Unit',
      unitPrice: 5000000,
    },
  ]);
  const [taxAmount, setTaxAmount] = useState<number>(1100000);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Load approved PRs for selection (only those with remaining un-ordered items)
    prApi
      .list({ status: 'APPROVED', hasRemainingPo: true })
      .then((res) => {
        const prList = res.data || [];
        setApprovedPrs(prList);
      })
      .catch(() => {});

    // Load dynamic approved vendors from backend
    vendorApi
      .list({ status: 'APPROVED' })
      .then((res) => {
        const vList = res.data || [];
        if (vList.length > 0) {
          setVendors(vList);
          setSelectedVendorId(vList[0].id);
          form.setFieldValue('vendorId', vList[0].id);
          if (vList[0].bankAccounts && vList[0].bankAccounts.length > 0) {
            form.setFieldValue('vendorBankAccountId', vList[0].bankAccounts[0].id);
          }
        }
      })
      .catch(() => {});

    if (initialPrId) {
      loadPrItems(initialPrId);
    }
  }, [initialPrId]);

  const loadPrItems = async (prId: string) => {
    try {
      const res = await prApi.getById(prId);
      const pr = res.data;
      if (pr) {
        form.setFieldsValue({
          paymentTermType: pr.paymentTermType || 'PAY_AFTER_RECEIPT',
        });
        if (pr.items && pr.items.length > 0) {
          const itemsWithRemaining = pr.items
            .filter((it: any) => {
              const req = Number(it.quantityRequested) || 0;
              const ord = Number(it.quantityOrdered) || 0;
              return (req - ord) > 0;
            })
            .map((it: any, idx: number) => {
              const req = Number(it.quantityRequested) || 0;
              const ord = Number(it.quantityOrdered) || 0;
              const remaining = Math.max(1, req - ord);
              return {
                key: it.id || `item-${idx}`,
                prItemId: it.id || '41000000-0000-0000-0000-000000000001',
                itemName: it.itemName,
                quantityOrdered: remaining,
                uom: it.uom || 'Unit',
                unitPrice: Number(it.estimatedUnitPrice) || 0,
              };
            });

          if (itemsWithRemaining.length === 0) {
            notification.warning({
              message: 'Seluruh Item PR Sudah Dipesan',
              description: `Seluruh item dalam Purchase Request '${pr.prNumber}' sudah diterbitkan Purchase Order (PO).`,
            });
          } else {
            setItems(itemsWithRemaining);
            const subtotal = itemsWithRemaining.reduce(
              (acc: number, curr: PoItemRow) => acc + curr.quantityOrdered * curr.unitPrice,
              0
            );
            setTaxAmount(Math.round(subtotal * 0.11));
          }
        }
      }
    } catch {
      // Keep default items on error
    }
  };

  const handlePrChange = (prId: string) => {
    setSelectedPrId(prId);
    if (prId) {
      loadPrItems(prId);
    }
  };

  const currentVendor = vendors.find((v) => v.id === selectedVendorId) || vendors[0];
  const availableBankAccounts = currentVendor.bankAccounts || [];

  const handleItemChange = (key: string, field: keyof PoItemRow, val: any) => {
    const updated = items.map((it) => {
      if (it.key === key) {
        return { ...it, [field]: val };
      }
      return it;
    });
    setItems(updated);
    const subtotal = updated.reduce((acc, curr) => acc + (Number(curr.quantityOrdered) || 0) * (Number(curr.unitPrice) || 0), 0);
    setTaxAmount(Math.round(subtotal * 0.11));
  };

  const addItemRow = () => {
    const newKey = String(Date.now());
    setItems([
      ...items,
      {
        key: newKey,
        prItemId: '41000000-0000-0000-0000-000000000001',
        itemName: '',
        quantityOrdered: 1,
        uom: 'Unit',
        unitPrice: 0,
      },
    ]);
  };

  const removeItemRow = (key: string) => {
    if (items.length <= 1) return;
    const filtered = items.filter((it) => it.key !== key);
    setItems(filtered);
  };

  const subtotalAmount = items.reduce(
    (acc, curr) => acc + (Number(curr.quantityOrdered) || 0) * (Number(curr.unitPrice) || 0),
    0
  );
  const grandTotalAmount = subtotalAmount + Number(taxAmount || 0);

  const handleSubmit = async (values: Record<string, any>) => {
    if (items.length === 0 || items.some((it) => !it.itemName || it.quantityOrdered <= 0)) {
      notification.error({ message: 'Semua item barang harus memiliki nama dan kuantitas valid!' });
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreatePoPayload = {
        vendorId: values.vendorId || selectedVendorId,
        vendorBankAccountId: values.vendorBankAccountId || availableBankAccounts[0]?.id || '30000000-0000-0000-0000-000000000001',
        paymentTermType: values.paymentTermType || 'PAY_AFTER_RECEIPT',
        taxAmount: Number(taxAmount) || 0,
        termsAndConditions: values.termsAndConditions || 'Standar syarat dan ketentuan pengadaan PT Nusanet.',
        items: items.map((it, idx) => ({
          prItemId: it.prItemId || '41000000-0000-0000-0000-000000000001',
          lineNumber: idx + 1,
          itemName: it.itemName,
          quantityOrdered: Number(it.quantityOrdered),
          uom: it.uom,
          unitPrice: Number(it.unitPrice),
        })),
      };

      const res = await poApi.create(payload);
      const poNum = res?.data?.poNumber || 'PO';
      notification.success({
        message: 'Purchase Order Berhasil Dibuat (R20)!',
        description: `Nomor PO ${poNum} telah tersimpan dan siap untuk disetujui serta diterbitkan resmi (R24).`,
      });
      navigate('/po');
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.response?.data?.title || err?.message || 'Gagal membuat PO';
      notification.error({ message: 'Pembuatan PO Ditolak Sistem', description: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Nama Barang / Jasa',
      dataIndex: 'itemName',
      key: 'itemName',
      render: (text: string, record: PoItemRow) => (
        <Input
          value={text}
          placeholder="Contoh: MikroTik CCR2004-16G-2S+"
          onChange={(e) => handleItemChange(record.key, 'itemName', e.target.value)}
        />
      ),
    },
    {
      title: 'Qty',
      dataIndex: 'quantityOrdered',
      key: 'quantityOrdered',
      width: 100,
      render: (val: number, record: PoItemRow) => (
        <InputNumber
          min={1}
          value={val}
          onChange={(newVal) => handleItemChange(record.key, 'quantityOrdered', newVal || 1)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Satuan',
      dataIndex: 'uom',
      key: 'uom',
      width: 110,
      render: (text: string, record: PoItemRow) => (
        <Input
          value={text}
          placeholder="Unit"
          onChange={(e) => handleItemChange(record.key, 'uom', e.target.value)}
        />
      ),
    },
    {
      title: 'Harga Satuan (Rp)',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 180,
      render: (val: number, record: PoItemRow) => (
        <InputNumber
          min={0}
          value={val}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
          parser={(v) => Number(v?.replace(/\./g, '') || 0)}
          onChange={(newVal) => handleItemChange(record.key, 'unitPrice', newVal || 0)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Subtotal',
      key: 'subtotal',
      width: 160,
      render: (_: unknown, record: PoItemRow) => (
        <Text strong>{formatRupiah((Number(record.quantityOrdered) || 0) * (Number(record.unitPrice) || 0))}</Text>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_: unknown, record: PoItemRow) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          disabled={items.length <= 1}
          onClick={() => removeItemRow(record.key)}
        />
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Penerbitan Surat Pesanan Baru (Purchase Order - R20–R24)"
        subtitle="Buat dan terbitkan PO resmi kepada vendor terverifikasi berdasarkan PR yang telah disetujui."
        icon={<FileTextOutlined style={{ color: token.colorPrimary }} />}
        breadcrumbs={[
          { title: 'Beranda', href: '/dashboard' },
          { title: 'Katalog PO', href: '/po' },
          { title: 'Buat PO Baru' },
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/po')}>
            Kembali ke Daftar PO
          </Button>
        }
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          prId: selectedPrId || undefined,
          vendorId: selectedVendorId,
          vendorBankAccountId: availableBankAccounts[0]?.id,
          paymentTermType: 'PAY_AFTER_RECEIPT',
          termsAndConditions:
            '1. Barang harus dikirimkan sesuai spesifikasi resmi PO.\n2. Pembayaran ditransfer ke rekening bank terdaftar setelah BAST dan invoice diverifikasi 2-Way Match.',
        }}
        onFinish={handleSubmit}
      >
        {/* Card 1: PR & Vendor Info */}
        <Card title="Referensi Pengadaan & Vendor Terverifikasi (4-Eyes Check - R17–R20)" style={{ marginBottom: 24 }}>
          <Alert
            message="Proteksi Kepatuhan Vendor & Rekening Bank (R20 & R65)"
            description="PO hanya dapat diterbitkan kepada Vendor berstatus APPROVED dan Rekening Bank yang telah lulus verifikasi 4-Eyes Stage 2."
            type="info"
            showIcon
            icon={<BankOutlined />}
            style={{ marginBottom: 20 }}
          />

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="prId" label="Pilih Purchase Request yang Disetujui (Opsional)">
                <Select
                  placeholder="Pilih PR yang sudah APPROVED"
                  allowClear
                  value={selectedPrId}
                  onChange={handlePrChange}
                >
                  {approvedPrs.map((pr) => (
                    <Select.Option key={pr.id} value={pr.id}>
                      {pr.prNumber} — {pr.costCenter} ({formatRupiah(Number(pr.totalEstimatedAmount))})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="vendorId"
                label="Vendor Penyedia (Master Vendor)"
                rules={[{ required: true, message: 'Vendor wajib dipilih!' }]}
              >
                <Select
                  placeholder="Pilih Vendor"
                  onChange={(vId) => {
                    setSelectedVendorId(vId);
                    const v = vendors.find((vend) => vend.id === vId);
                    if (v && v.bankAccounts && v.bankAccounts.length > 0) {
                      form.setFieldValue('vendorBankAccountId', v.bankAccounts[0].id);
                    }
                  }}
                >
                  {vendors.map((v) => (
                    <Select.Option key={v.id} value={v.id}>
                      {v.name} ({v.vendorCode}) — <Tag color="green">{v.status}</Tag>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="vendorBankAccountId"
                label="Rekening Bank Tujuan Transfer (4-Eyes Verified)"
                rules={[{ required: true, message: 'Rekening bank vendor wajib dipilih!' }]}
              >
                <Select placeholder="Pilih Rekening Bank">
                  {availableBankAccounts.map((acc) => (
                    <Select.Option key={acc.id} value={acc.id}>
                      {acc.bankName} • {acc.accountNumberMasked} a/n {acc.accountHolderName} ({acc.status})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="paymentTermType"
                label="Termin Pembayaran"
                rules={[{ required: true, message: 'Termin pembayaran wajib dipilih!' }]}
              >
                <Select placeholder="Pilih Termin Pembayaran">
                  <Select.Option value="PAY_AFTER_RECEIPT">Pay After Receipt (Standar)</Select.Option>
                  <Select.Option value="ADVANCE_OR_COD">Advance / Cash on Delivery (COD)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Card 2: Items Table */}
        <Card
          title="Daftar Barang / Jasa yang Dipesan"
          extra={
            <Button type="dashed" icon={<PlusOutlined />} onClick={addItemRow}>
              Tambah Baris Item
            </Button>
          }
          style={{ marginBottom: 24 }}
        >
          <Table
            dataSource={items}
            columns={columns}
            pagination={false}
            size="middle"
            scroll={{ x: 700 }}
          />
        </Card>

        {/* Card 3: Terms & Summary */}
        <Card title="Klausul Syarat Ketentuan & Ringkasan Nilai PO" style={{ marginBottom: 24 }}>
          <Row gutter={24}>
            <Col xs={24} md={14}>
              <Form.Item
                name="termsAndConditions"
                label="Syarat & Ketentuan PO (Terms & Conditions - R26)"
                rules={[{ required: true, message: 'Syarat & ketentuan wajib diisi!' }]}
              >
                <TextArea rows={5} placeholder="Masukkan syarat dan ketentuan pengadaan..." />
              </Form.Item>
            </Col>

            <Col xs={24} md={10}>
              <Card type="inner" title="Ringkasan Total Biaya Pesanan">
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Subtotal Barang/Jasa:</Text>
                    <Text strong>{formatRupiah(subtotalAmount)}</Text>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary">PPN / Pajak:</Text>
                    <InputNumber
                      min={0}
                      value={taxAmount}
                      formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                      parser={(v) => Number(v?.replace(/\./g, '') || 0)}
                      onChange={(v) => setTaxAmount(Number(v) || 0)}
                      style={{ width: 140 }}
                    />
                  </div>

                  <Divider style={{ margin: '8px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Title level={4} style={{ margin: 0 }}>
                      Grand Total:
                    </Title>
                    <Title level={4} style={{ margin: 0, color: token.colorPrimary }}>
                      {formatRupiah(grandTotalAmount)}
                    </Title>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </Card>

        <Space size={12}>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            icon={<CheckCircleOutlined />}
            loading={submitting}
          >
            Simpan & Terbitkan PO (R20)
          </Button>
          <Button size="large" onClick={() => navigate('/po')} disabled={submitting}>
            Batal
          </Button>
        </Space>
      </Form>
    </div>
  );
};

export default PoCreateForm;
