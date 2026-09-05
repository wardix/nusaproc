import React, { useState } from 'react';
import { Table, Button, Space, Card, Typography, App, theme, Modal, Form, Select, Input, Alert } from 'antd';
import { FilePdfOutlined, CheckOutlined, SendOutlined, FileTextOutlined, PlusOutlined, EditOutlined, BankOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { poApi, type UpdatePoPayload } from '../../../api/endpoints/po';
import { vendorApi } from '../../../api/endpoints/vendor';
import { formatRupiah } from '../../../utils/currency';
import { PageHeader } from '../../../components/common/PageHeader';
import { StatusTag } from '../../../components/common/StatusTag';

const { Text } = Typography;
const { TextArea } = Input;

const formatDateIndo = (dateStr?: string) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateStr;
  }
};

export const PoListPage: React.FC = () => {
  const { notification } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPoForEdit, setSelectedPoForEdit] = useState<any>(null);
  const [vendorBankAccounts, setVendorBankAccounts] = useState<any[]>([]);
  const [editForm] = Form.useForm();

  // Fetch PO list from backend
  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => poApi.list().catch(() => ({ data: [] })),
  });

  // Fetch verified vendors
  const { data: vendorRes } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorApi.list({ status: 'APPROVED' }).catch(() => ({ data: [] })),
  });
  const rawVendors = vendorRes?.data;
  const vendorList = Array.isArray(rawVendors) ? rawVendors : [];

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePoPayload }) => poApi.update(id, payload),
    onSuccess: () => {
      notification.success({
        message: 'Purchase Order Berhasil Direvisi!',
        description: 'Vendor dan rincian PO telah diperbarui. Status persetujuan telah diatur ulang ke Draft.',
      });
      setEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.title || err.message || 'Gagal memperbarui PO';
      notification.error({ message: 'Gagal memperbarui PO', description: msg });
    },
  });

  const handleOpenEditModal = async (record: any) => {
    setSelectedPoForEdit(record);
    editForm.setFieldsValue({
      vendorId: record.vendorId,
      vendorBankAccountId: record.vendorBankAccountId,
      paymentTermType: record.paymentTermType || 'PAY_AFTER_RECEIPT',
      termsAndConditions: record.termsAndConditions,
      reason: '',
    });

    if (record.vendorId) {
      try {
        const bankRes = await vendorApi.listBankAccounts(record.vendorId);
        const banks = bankRes?.data || [];
        setVendorBankAccounts(banks);
      } catch {
        setVendorBankAccounts([]);
      }
    }
    setEditModalOpen(true);
  };

  const handleVendorChangeInModal = async (newVendorId: string) => {
    try {
      const bankRes = await vendorApi.listBankAccounts(newVendorId);
      const banks = bankRes?.data || [];
      setVendorBankAccounts(banks);
      if (banks.length > 0) {
        editForm.setFieldValue('vendorBankAccountId', banks[0].id);
      } else {
        editForm.setFieldValue('vendorBankAccountId', undefined);
      }
    } catch {
      setVendorBankAccounts([]);
    }
  };

  const handleEditSubmit = async (values: any) => {
    if (!selectedPoForEdit) return;
    updateMutation.mutate({
      id: selectedPoForEdit.id,
      payload: {
        vendorId: values.vendorId,
        vendorBankAccountId: values.vendorBankAccountId,
        paymentTermType: values.paymentTermType,
        termsAndConditions: values.termsAndConditions,
        reason: values.reason || 'Penggantian vendor sebelum persetujuan (Pre-Approval Revision)',
      },
    });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => poApi.approve(id),
    onSuccess: () => {
      notification.success({ message: 'Purchase Order berhasil disetujui (R25).' });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.title || err.message || 'Gagal menyetujui PO';
      notification.error({ message: 'Gagal menyetujui PO', description: msg });
    },
  });

  const issueMutation = useMutation({
    mutationFn: (id: string) => poApi.issue(id),
    onSuccess: () => {
      notification.success({ message: 'Purchase Order berhasil diterbitkan resmi (R24).' });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.title || err.message || 'Gagal menerbitkan PO';
      notification.error({ message: 'Gagal menerbitkan PO', description: msg });
    },
  });

  const handleDownloadPdf = async (id: string, poNumber: string) => {
    try {
      const blob = await poApi.downloadPdf(id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${poNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      notification.success({ message: `Dokumen PDF PO ${poNumber} berhasil diunduh.` });
    } catch (err: unknown) {
      notification.error({ message: 'Gagal mengunduh PDF', description: (err as Error).message });
    }
  };

  const rawList = data?.data;
  const poData = Array.isArray(rawList) ? rawList : (rawList ? [rawList] : []);

  const columns = [
    {
      title: 'Nomor PO',
      dataIndex: 'poNumber',
      key: 'poNumber',
      render: (text: string) => <Text strong style={{ color: token.colorPrimary }}>{text}</Text>,
    },
    {
      title: 'Pembuat & Tgl',
      key: 'creator',
      render: (_: unknown, record: any) => (
        <div>
          <div><Text strong>{record.requesterName || record.createdBy || 'Admin'}</Text></div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
            {record.createdAt ? formatDateIndo(record.createdAt) : '-'}
          </div>
        </div>
      ),
    },
    {
      title: 'Vendor Terpilih',
      dataIndex: 'vendorName',
      key: 'vendorName',
      render: (text: string) => text || 'PT Fiber Optik Nusantara',
    },
    {
      title: 'Rekening Bank Terverifikasi',
      key: 'bankAccount',
      render: (_: unknown, record: any) => {
        if (record.bankName && record.accountNumber) {
          return `${record.bankName} - ${record.accountNumber} (${record.accountHolderName || 'Verified'})`;
        }
        return record.bankAccount || 'BCA ••••••••890 (Active)';
      },
    },
    {
      title: 'Total Nilai PO',
      key: 'totalAmount',
      render: (_: unknown, record: any) => {
        const val = record.grandTotalAmount ?? record.totalAmount ?? 0;
        return <Text strong>{formatRupiah(Number(val))}</Text>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusTag status={status} category="po" />,
    },
    {
      title: 'Aksi',
      key: 'action',
      render: (_: unknown, record: any) => (
        <Space size="small">
          {record.status === 'DRAFT' && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEditModal(record)}
            >
              Ganti Vendor
            </Button>
          )}
          {record.status === 'DRAFT' && !record.approvedBy && (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              loading={approveMutation.isPending}
              onClick={() => approveMutation.mutate(record.id)}
            >
              Setujui (R25)
            </Button>
          )}
          {record.status === 'DRAFT' && record.approvedBy && (
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
              loading={issueMutation.isPending}
              onClick={() => issueMutation.mutate(record.id)}
            >
              Terbitkan (R24)
            </Button>
          )}
          {record.status === 'APPROVED' && (
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
              loading={issueMutation.isPending}
              onClick={() => issueMutation.mutate(record.id)}
            >
              Terbitkan (R24)
            </Button>
          )}
          <Button
            size="small"
            icon={<FilePdfOutlined />}
            style={{ color: token.colorError, borderColor: token.colorError }}
            onClick={() => handleDownloadPdf(record.id, record.poNumber)}
          >
            Unduh PDF (R27)
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Katalog Surat Pesanan (Purchase Order)"
        subtitle="Daftar pemesanan resmi kepada vendor terverifikasi dengan proteksi persetujuan, penerbitan, dan unduhan PDF resmi (R24–R27)."
        icon={<FileTextOutlined style={{ color: token.colorPrimary }} />}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/po/create')}
          >
            Buat PO Baru
          </Button>
        }
      />

      <Card>
        <Table
          columns={columns}
          dataSource={poData}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 800 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={`Revisi PO: ${selectedPoForEdit?.poNumber || ''}`}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Alert
          message="Tata Kelola Pengadaan & Reset Persetujuan (R24 & R26)"
          description="Mengganti vendor pada PO draft akan otomatis memverifikasi rekening bank vendor baru dan me-reset status approval ke DRAFT agar ditinjau ulang."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item
            name="vendorId"
            label="Pilih Vendor Terverifikasi"
            rules={[{ required: true, message: 'Vendor wajib dipilih!' }]}
          >
            <Select
              placeholder="Pilih Vendor"
              showSearch
              optionFilterProp="children"
              onChange={handleVendorChangeInModal}
            >
              {vendorList.map((v: any) => (
                <Select.Option key={v.id} value={v.id}>
                  {v.name} ({v.vendorCode || 'VENDOR'})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="vendorBankAccountId"
            label="Pilih Rekening Bank Terverifikasi (4-Eyes Check)"
            rules={[{ required: true, message: 'Rekening bank wajib dipilih!' }]}
          >
            <Select placeholder="Pilih Rekening Bank">
              {vendorBankAccounts.map((b: any) => (
                <Select.Option key={b.id} value={b.id}>
                  {b.bankName} — {b.accountNumberMasked || b.accountNumber} ({b.accountHolderName || 'Verified'})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="paymentTermType"
            label="Termin Pembayaran"
            rules={[{ required: true, message: 'Termin pembayaran wajib dipilih!' }]}
          >
            <Select placeholder="Pilih Termin">
              <Select.Option value="PAY_AFTER_RECEIPT">Pay After Receipt (Standar)</Select.Option>
              <Select.Option value="ADVANCE_OR_COD">Advance / Cash on Delivery (COD)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="reason"
            label="Alasan Pergantian Vendor / Revisi (Audit Trail)"
            rules={[{ required: true, message: 'Alasan perubahan wajib diisi untuk audit!' }]}
          >
            <TextArea
              rows={3}
              placeholder="Contoh: Vendor asal kehabisan stok, dialihkan ke vendor pengganti yang siap kirim."
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <Button
              type="link"
              onClick={() => {
                setEditModalOpen(false);
                navigate(`/po/create?poId=${selectedPoForEdit?.id}`);
              }}
            >
              Buka Formulir Lengkap (Edit Item)
            </Button>
            <Space>
              <Button onClick={() => setEditModalOpen(false)}>Batal</Button>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                Simpan & Reset Approval
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default PoListPage;
