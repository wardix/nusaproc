import React, { useState, useEffect, useMemo } from 'react';
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
  Modal,
  Badge,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  BankOutlined,
  PlusOutlined,
  DeleteOutlined,
  AppstoreAddOutlined,
  SearchOutlined,
  CheckSquareOutlined,
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
  prId?: string;
  prNumber?: string;
  divisionName?: string;
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
  const initialPoId = searchParams.get('poId') || '';
  const isEditMode = Boolean(initialPoId);

  const [form] = Form.useForm();
  const [approvedPrs, setApprovedPrs] = useState<any[]>([]);

  // Collect any initial prId or prIds from URL query
  const prIdParams = searchParams.getAll('prId');
  const prIdsParam = searchParams.get('prIds')?.split(',').filter(Boolean) || [];
  const initialPrIds = useMemo(
    () => Array.from(new Set([...prIdParams, ...prIdsParam])),
    [searchParams]
  );

  const [selectedPrIds, setSelectedPrIds] = useState<string[]>(initialPrIds);
  const [vendors, setVendors] = useState<VendorOption[]>(DEFAULT_VENDORS);
  const [selectedVendorId, setSelectedVendorId] = useState<string>(DEFAULT_VENDORS[0].id);
  const [editingPoNumber, setEditingPoNumber] = useState<string>('');
  const [items, setItems] = useState<PoItemRow[]>([
    {
      key: '1',
      prItemId: '41000000-0000-0000-0000-000000000001',
      prNumber: 'PR-MANUAL',
      itemName: 'Core Edge Router 10G',
      quantityOrdered: 2,
      uom: 'Unit',
      unitPrice: 5000000,
    },
  ]);
  const [taxAmount, setTaxAmount] = useState<number>(1100000);
  const [submitting, setSubmitting] = useState(false);

  // Multi-PR Item Picker state
  const [pickerModalOpen, setPickerModalOpen] = useState(false);
  const [unfulfilledPrItems, setUnfulfilledPrItems] = useState<any[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [selectedPickerRowKeys, setSelectedPickerRowKeys] = useState<React.Key[]>([]);
  const [selectedPickerItems, setSelectedPickerItems] = useState<any[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');

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
          if (!isEditMode) {
            setSelectedVendorId(vList[0].id);
            form.setFieldValue('vendorId', vList[0].id);
            if (vList[0].bankAccounts && vList[0].bankAccounts.length > 0) {
              form.setFieldValue('vendorBankAccountId', vList[0].bankAccounts[0].id);
            }
          }
        }
      })
      .catch(() => {});

    if (initialPoId) {
      loadPoDetails(initialPoId);
    } else if (initialPrIds.length > 0) {
      loadPrItemsByIds(initialPrIds);
    }
  }, [initialPoId]);

  const loadPoDetails = async (poId: string) => {
    try {
      const res = await poApi.getById(poId);
      const po = res.data;
      if (po) {
        setEditingPoNumber(po.poNumber);
        setSelectedVendorId(po.vendorId);
        form.setFieldsValue({
          vendorId: po.vendorId,
          vendorBankAccountId: po.vendorBankAccountId,
          paymentTermType: po.paymentTermType || 'PAY_AFTER_RECEIPT',
          termsAndConditions: po.termsAndConditions,
        });

        if (po.items && po.items.length > 0) {
          const poItems = po.items.map((it: any, idx: number) => ({
            key: it.id || `item-${idx}`,
            prItemId: it.prItemId,
            itemName: it.itemName,
            quantityOrdered: Number(it.quantityOrdered),
            uom: it.uom,
            unitPrice: Number(it.unitPrice),
          }));
          setItems(poItems);
        }
        setTaxAmount(Number(po.taxAmount) || 0);
      }
    } catch (err: any) {
      notification.error({ message: 'Gagal memuat detail PO untuk diedit', description: err.message });
    }
  };

  const loadPrItemsByIds = async (prIds: string[], append: boolean = false) => {
    if (prIds.length === 0) {
      if (!append) setItems([]);
      return;
    }

    try {
      const results = await Promise.all(
        prIds.map((id) => prApi.getById(id).catch(() => null))
      );

      const newRows: PoItemRow[] = [];
      let foundAnyItems = false;

      results.forEach((res) => {
        const pr = res?.data;
        if (pr) {
          if (!form.getFieldValue('paymentTermType') && pr.paymentTermType) {
            form.setFieldValue('paymentTermType', pr.paymentTermType);
          }
          if (pr.items && pr.items.length > 0) {
            const itemsWithRemaining = pr.items
              .filter((it: any) => {
                const req = Number(it.quantityRequested) || 0;
                const ord = Number(it.quantityOrdered) || 0;
                return req - ord > 0;
              })
              .map((it: any, idx: number) => {
                const req = Number(it.quantityRequested) || 0;
                const ord = Number(it.quantityOrdered) || 0;
                const remaining = Math.max(1, req - ord);
                foundAnyItems = true;
                return {
                  key: it.id || `item-${pr.id}-${idx}`,
                  prItemId: it.id || '41000000-0000-0000-0000-000000000001',
                  prId: pr.id,
                  prNumber: pr.prNumber,
                  divisionName: pr.divisionName || pr.costCenter,
                  itemName: it.itemName,
                  quantityOrdered: remaining,
                  uom: it.uom || 'Unit',
                  unitPrice: Number(it.estimatedUnitPrice) || 0,
                };
              });
            newRows.push(...itemsWithRemaining);
          }
        }
      });

      if (results.length === 1 && !foundAnyItems && results[0]?.data) {
        notification.warning({
          message: 'Seluruh Item PR Sudah Dipesan',
          description: `Seluruh item dalam Purchase Request '${results[0].data.prNumber}' sudah diterbitkan Purchase Order (PO).`,
        });
      }

      setItems((prev) => {
        const base = append
          ? prev.filter((it) => it.itemName !== 'Core Edge Router 10G' || prev.length > 1)
          : [];
        const existingPrItemIds = new Set(base.map((it) => it.prItemId));
        const filteredNew = newRows.filter((it) => !existingPrItemIds.has(it.prItemId));
        const merged = [...base, ...filteredNew];

        const subtotal = merged.reduce(
          (acc, curr) => acc + (Number(curr.quantityOrdered) || 0) * (Number(curr.unitPrice) || 0),
          0
        );
        setTaxAmount(Math.round(subtotal * 0.11));
        return merged.length > 0 ? merged : prev;
      });
    } catch {
      // Keep default items on error
    }
  };

  const openPrItemPicker = async () => {
    setPickerModalOpen(true);
    setPickerLoading(true);
    try {
      const res = await prApi.listUnfulfilledItems();
      const list = res.data || [];
      setUnfulfilledPrItems(list);
      setSelectedPickerRowKeys([]);
      setSelectedPickerItems([]);
    } catch (err: any) {
      notification.error({ message: 'Gagal memuat item PR yang disetujui', description: err.message });
    } finally {
      setPickerLoading(false);
    }
  };

  const handleAddSelectedPrItems = () => {
    if (selectedPickerItems.length === 0) return;

    // Filter out default placeholder item if it was never customized
    const currentItems = items.filter(
      (it) => it.itemName !== 'Core Edge Router 10G' || items.length > 1
    );

    const existingPrItemIds = new Set(currentItems.map((it) => it.prItemId));

    const newRows: PoItemRow[] = selectedPickerItems
      .filter((item) => !existingPrItemIds.has(item.id))
      .map((item, idx) => ({
        key: item.id || `pr-item-${Date.now()}-${idx}`,
        prItemId: item.id,
        prId: item.prId,
        prNumber: item.prNumber,
        divisionName: item.divisionName || item.costCenter,
        itemName: item.itemName,
        quantityOrdered: Number(item.remainingQuantity) || 1,
        uom: item.uom || 'Unit',
        unitPrice: Number(item.estimatedUnitPrice) || 0,
      }));

    if (newRows.length === 0) {
      notification.info({ message: 'Semua item yang dipilih sudah ada dalam rincian PO!' });
      setPickerModalOpen(false);
      return;
    }

    const updated = [...currentItems, ...newRows];
    setItems(updated);

    // Sync newly picked PR IDs into selectedPrIds multi-select
    const pickedPrIds = selectedPickerItems.map((it) => it.prId).filter(Boolean);
    const mergedPrIds = Array.from(new Set([...selectedPrIds, ...pickedPrIds]));
    setSelectedPrIds(mergedPrIds);
    form.setFieldValue('prIds', mergedPrIds);

    const subtotal = updated.reduce(
      (acc, curr) => acc + (Number(curr.quantityOrdered) || 0) * (Number(curr.unitPrice) || 0),
      0
    );
    setTaxAmount(Math.round(subtotal * 0.11));

    setPickerModalOpen(false);
    notification.success({
      message: `${newRows.length} Item Berhasil Ditambahkan ke PO!`,
      description: 'Item dari berbagai PR yang dipilih telah digabungkan ke dalam rincian PO.',
    });
  };

  const filteredPrItems = useMemo(() => {
    if (!pickerSearch.trim()) return unfulfilledPrItems;
    const term = pickerSearch.toLowerCase();
    return unfulfilledPrItems.filter(
      (it) =>
        it.itemName?.toLowerCase().includes(term) ||
        it.prNumber?.toLowerCase().includes(term) ||
        it.divisionName?.toLowerCase().includes(term) ||
        it.costCenter?.toLowerCase().includes(term) ||
        it.specification?.toLowerCase().includes(term)
    );
  }, [unfulfilledPrItems, pickerSearch]);

  const handlePrsChange = async (newPrIds: string[]) => {
    const previousPrIds = selectedPrIds;
    setSelectedPrIds(newPrIds);
    form.setFieldValue('prIds', newPrIds);

    const addedPrIds = newPrIds.filter((id) => !previousPrIds.includes(id));
    const removedPrIds = previousPrIds.filter((id) => !newPrIds.includes(id));

    let updatedItems = items;

    // 1. Remove items belonging to removed PRs
    if (removedPrIds.length > 0) {
      const removedSet = new Set(removedPrIds);
      updatedItems = updatedItems.filter((it) => !it.prId || !removedSet.has(it.prId));
    }

    // 2. Add items from newly selected PRs
    if (addedPrIds.length > 0) {
      try {
        const results = await Promise.all(
          addedPrIds.map((id) => prApi.getById(id).catch(() => null))
        );

        const newRows: PoItemRow[] = [];
        results.forEach((res) => {
          const pr = res?.data;
          if (pr && pr.items && pr.items.length > 0) {
            const itemsWithRemaining = pr.items
              .filter((it: any) => {
                const req = Number(it.quantityRequested) || 0;
                const ord = Number(it.quantityOrdered) || 0;
                return req - ord > 0;
              })
              .map((it: any, idx: number) => {
                const req = Number(it.quantityRequested) || 0;
                const ord = Number(it.quantityOrdered) || 0;
                const remaining = Math.max(1, req - ord);
                return {
                  key: it.id || `item-${pr.id}-${idx}`,
                  prItemId: it.id,
                  prId: pr.id,
                  prNumber: pr.prNumber,
                  divisionName: pr.divisionName || pr.costCenter,
                  itemName: it.itemName,
                  quantityOrdered: remaining,
                  uom: it.uom || 'Unit',
                  unitPrice: Number(it.estimatedUnitPrice) || 0,
                };
              });
            newRows.push(...itemsWithRemaining);
          }
        });

        // Filter out default placeholder item if unmodified
        const base = updatedItems.filter(
          (it) => it.itemName !== 'Core Edge Router 10G' || updatedItems.length > 1
        );
        const existingPrItemIds = new Set(base.map((it) => it.prItemId));
        const filteredNew = newRows.filter((it) => !existingPrItemIds.has(it.prItemId));
        updatedItems = [...base, ...filteredNew];
      } catch {
        // Keep existing on error
      }
    }

    setItems(updatedItems);
    const subtotal = updatedItems.reduce(
      (acc, curr) => acc + (Number(curr.quantityOrdered) || 0) * (Number(curr.unitPrice) || 0),
      0
    );
    setTaxAmount(Math.round(subtotal * 0.11));
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
      const payload: CreatePoPayload & { reason?: string } = {
        vendorId: values.vendorId || selectedVendorId,
        vendorBankAccountId: values.vendorBankAccountId || availableBankAccounts[0]?.id || '30000000-0000-0000-0000-000000000001',
        paymentTermType: values.paymentTermType || 'PAY_AFTER_RECEIPT',
        taxAmount: Number(taxAmount) || 0,
        termsAndConditions: values.termsAndConditions || 'Standar syarat dan ketentuan pengadaan PT Nusanet.',
        reason: values.reason || 'Revisi vendor / PO sebelum persetujuan',
        items: items.map((it, idx) => ({
          prItemId: it.prItemId || '41000000-0000-0000-0000-000000000001',
          lineNumber: idx + 1,
          itemName: it.itemName,
          quantityOrdered: Number(it.quantityOrdered),
          uom: it.uom,
          unitPrice: Number(it.unitPrice),
        })),
      };

      if (isEditMode && initialPoId) {
        await poApi.update(initialPoId, payload);
        notification.success({
          message: 'Purchase Order Berhasil Direvisi!',
          description: `PO ${editingPoNumber || initialPoId} berhasil diperbarui. Status persetujuan telah diatur ulang ke Draft untuk ditinjau ulang.`,
        });
      } else {
        const res = await poApi.create(payload);
        const poNum = res?.data?.poNumber || 'PO';
        notification.success({
          message: 'Purchase Order Berhasil Dibuat (R20)!',
          description: `Nomor PO ${poNum} telah tersimpan dan siap untuk disetujui serta diterbitkan resmi (R24).`,
        });
      }
      navigate('/po');
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.response?.data?.title || err?.message || 'Gagal menyimpan PO';
      notification.error({ message: 'Operasi PO Ditolak Sistem', description: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'PR Asal',
      key: 'prReference',
      width: 150,
      render: (_: unknown, record: PoItemRow) => (
        <div>
          <Tag color="blue">{record.prNumber || 'Manual / PR'}</Tag>
          {record.divisionName && (
            <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
              {record.divisionName}
            </div>
          )}
        </div>
      ),
    },
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
      width: 90,
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
      width: 90,
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
      width: 160,
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
      width: 150,
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
        title={isEditMode ? `Revisi Surat Pesanan (${editingPoNumber || 'PO'})` : "Penerbitan Surat Pesanan Baru (Purchase Order - R20–R24)"}
        subtitle={isEditMode ? "Ubah vendor, rekening bank, termin pembayaran, atau rincian item sebelum PO disetujui / diterbitkan." : "Buat dan terbitkan PO resmi kepada vendor terverifikasi berdasarkan PR yang telah disetujui."}
        icon={<FileTextOutlined style={{ color: token.colorPrimary }} />}
        breadcrumbs={[
          { title: 'Beranda', href: '/dashboard' },
          { title: 'Katalog PO', href: '/po' },
          { title: isEditMode ? 'Revisi PO' : 'Buat PO Baru' },
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
          prIds: selectedPrIds,
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
              <Form.Item
                name="prIds"
                label={
                  <Space>
                    <span>Pilih Purchase Request yang Disetujui</span>
                    <Tag color="cyan">Multi-PR Konsolidasi</Tag>
                  </Space>
                }
                tooltip="Anda dapat memilih satu atau beberapa PR yang telah APPROVED untuk digabungkan ke dalam 1 PO."
              >
                <Select
                  mode="multiple"
                  placeholder="Pilih satu atau beberapa PR (Multi-PR)"
                  allowClear
                  value={selectedPrIds}
                  onChange={handlePrsChange}
                  optionFilterProp="label"
                  tagRender={(props) => {
                    const { label, closable, onClose } = props;
                    return (
                      <Tag color="blue" closable={closable} onClose={onClose} style={{ marginRight: 3 }}>
                        {label}
                      </Tag>
                    );
                  }}
                >
                  {approvedPrs.map((pr) => (
                    <Select.Option key={pr.id} value={pr.id} label={pr.prNumber}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                          <strong>{pr.prNumber}</strong> — {pr.costCenter || pr.divisionName}
                        </span>
                        <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                          {formatRupiah(Number(pr.totalEstimatedAmount))}
                        </span>
                      </div>
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
          title={
            <Space>
              <span>Daftar Barang / Jasa yang Dipesan</span>
              <Badge count={items.length} style={{ backgroundColor: token.colorPrimary }} />
            </Space>
          }
          extra={
            <Space>
              <Button
                type="primary"
                icon={<AppstoreAddOutlined />}
                onClick={openPrItemPicker}
                style={{ background: '#1677ff', borderColor: '#1677ff' }}
              >
                Ambil Item dari PR (Multi-PR Picker)
              </Button>
              <Button type="dashed" icon={<PlusOutlined />} onClick={addItemRow}>
                Tambah Baris Manual
              </Button>
            </Space>
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

        {isEditMode && (
          <Card title="Alasan Revisi / Penggantian Vendor (Audit Trail Log)" style={{ marginBottom: 24 }}>
            <Form.Item
              name="reason"
              label="Catatan Alasan Perubahan"
              rules={[{ required: true, message: 'Alasan perubahan/revisi PO wajib diisi untuk kepatuhan audit!' }]}
            >
              <TextArea
                rows={3}
                placeholder="Contoh: Vendor A stok habis, pesanan dialihkan ke Vendor B yang memiliki ketersediaan stok ready."
              />
            </Form.Item>
          </Card>
        )}

        <Space size={12}>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            icon={<CheckCircleOutlined />}
            loading={submitting}
          >
            {isEditMode ? 'Simpan Revisi PO & Reset Approval' : 'Simpan & Terbitkan PO (R20)'}
          </Button>
          <Button size="large" onClick={() => navigate('/po')} disabled={submitting}>
            Batal
          </Button>
        </Space>
      </Form>

      {/* Multi-PR Item Picker Modal */}
      <Modal
        title={
          <Space>
            <AppstoreAddOutlined style={{ color: token.colorPrimary }} />
            <span>Multi-PR Item Picker — Pilih Item dari Berbagai PR yang Sudah Disetujui</span>
          </Space>
        }
        open={pickerModalOpen}
        onCancel={() => setPickerModalOpen(false)}
        width={950}
        footer={[
          <div key="footer-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">
              Terpilih: <Text strong style={{ color: token.colorPrimary }}>{selectedPickerRowKeys.length}</Text> item dari berbagai PR
            </Text>
            <Space>
              <Button onClick={() => setPickerModalOpen(false)}>Batal</Button>
              <Button
                type="primary"
                icon={<CheckSquareOutlined />}
                disabled={selectedPickerRowKeys.length === 0}
                onClick={handleAddSelectedPrItems}
              >
                Tambahkan ke PO ({selectedPickerRowKeys.length} Item)
              </Button>
            </Space>
          </div>,
        ]}
        destroyOnClose
      >
        <Alert
          message="Konsolidasi Pengadaan Multi-PR ke 1 PO"
          description="Anda dapat memilih dan menggabungkan item dari beberapa Purchase Request (PR) yang berbeda ke dalam satu Surat Pesanan (PO) untuk dikirim ke Vendor yang sama."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Input
          placeholder="Cari berdasarkan nama barang, nomor PR, divisi, spesifikasi..."
          prefix={<SearchOutlined style={{ color: token.colorTextSecondary }} />}
          value={pickerSearch}
          onChange={(e) => setPickerSearch(e.target.value)}
          allowClear
          style={{ marginBottom: 16 }}
        />

        <Table
          dataSource={filteredPrItems}
          rowKey="id"
          loading={pickerLoading}
          pagination={{ pageSize: 6 }}
          size="small"
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedPickerRowKeys,
            onChange: (keys, rows) => {
              setSelectedPickerRowKeys(keys);
              setSelectedPickerItems(rows);
            },
          }}
          columns={[
            {
              title: 'No. PR & Divisi',
              key: 'prNumber',
              width: 180,
              render: (_: unknown, record: any) => (
                <div>
                  <Tag color="blue">{record.prNumber}</Tag>
                  <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                    {record.divisionName || record.costCenter || 'Unit Kerja'}
                  </div>
                </div>
              ),
            },
            {
              title: 'Nama Barang & Spesifikasi',
              key: 'itemInfo',
              render: (_: unknown, record: any) => (
                <div>
                  <Text strong>{record.itemName}</Text>
                  {record.specification && (
                    <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                      {record.specification}
                    </div>
                  )}
                </div>
              ),
            },
            {
              title: 'Sisa Kebutuhan',
              key: 'remainingQuantity',
              width: 130,
              render: (_: unknown, record: any) => (
                <Tag color="orange">
                  {record.remainingQuantity} {record.uom}
                </Tag>
              ),
            },
            {
              title: 'Estimasi Harga',
              dataIndex: 'estimatedUnitPrice',
              key: 'estimatedUnitPrice',
              width: 150,
              render: (price: number) => formatRupiah(Number(price)),
            },
            {
              title: 'Subtotal Estimasi',
              key: 'subtotal',
              width: 150,
              render: (_: unknown, record: any) => (
                <Text strong>{formatRupiah(Number(record.remainingQuantity) * Number(record.estimatedUnitPrice))}</Text>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default PoCreateForm;

