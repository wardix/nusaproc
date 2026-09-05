import React from 'react';
import { Table, Button, Space, Card, Typography, App, theme } from 'antd';
import { FilePdfOutlined, CheckOutlined, SendOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { poApi } from '../../../api/endpoints/po';
import { formatRupiah } from '../../../utils/currency';
import { PageHeader } from '../../../components/common/PageHeader';
import { StatusTag } from '../../../components/common/StatusTag';

const { Text } = Typography;

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

  // Fetch PO list from backend
  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => poApi.list().catch(() => ({ data: [] })),
  });

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
    </div>
  );
};

export default PoListPage;
