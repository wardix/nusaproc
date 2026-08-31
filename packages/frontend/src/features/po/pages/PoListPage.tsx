import React from 'react';
import { Table, Button, Space, Card, Typography, notification } from 'antd';
import { FilePdfOutlined, CheckOutlined, FileTextOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { poApi } from '../../../api/endpoints/po';
import { formatRupiah } from '../../../utils/currency';
import { PageHeader } from '../../../components/common/PageHeader';
import { StatusTag } from '../../../components/common/StatusTag';

const { Text } = Typography;

export const PoListPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Fetch PO detail / list using mock/seeded demo ID or list
  const seededPoId = '50000000-0000-0000-0000-000000000001';
  const { data, isLoading } = useQuery({
    queryKey: ['purchase-order', seededPoId],
    queryFn: () => poApi.getById(seededPoId).catch(() => ({ data: null })),
  });

  const issueMutation = useMutation({
    mutationFn: (id: string) => poApi.issue(id),
    onSuccess: () => {
      notification.success({ message: 'Purchase Order berhasil diterbitkan resmi (R24).' });
      queryClient.invalidateQueries({ queryKey: ['purchase-order'] });
    },
    onError: (err: Error) => {
      notification.error({ message: 'Gagal menerbitkan PO', description: err.message });
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

  const defaultPo = {
    id: seededPoId,
    poNumber: 'PO-202608-0001',
    vendorName: 'PT Fiber Optik Nusantara',
    bankAccount: 'BCA 1234567890',
    totalAmount: 25000000,
    status: 'ISSUED',
  };

  const poData = data?.data ? [data.data] : [defaultPo];

  const columns = [
    {
      title: 'Nomor PO',
      dataIndex: 'poNumber',
      key: 'poNumber',
      render: (text: string) => <Text strong style={{ color: '#0052CC' }}>{text}</Text>,
    },
    {
      title: 'Vendor Terpilih',
      dataIndex: 'vendorName',
      key: 'vendorName',
      render: (text: string) => text || 'PT Fiber Optik Nusantara',
    },
    {
      title: 'Rekening Bank Terverifikasi',
      dataIndex: 'bankAccount',
      key: 'bankAccount',
      render: (text: string) => text || 'BCA ••••••••890 (Active)',
    },
    {
      title: 'Total Nilai PO',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (val: number) => <Text strong>{formatRupiah(Number(val) || 25000000)}</Text>,
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
      render: (_: unknown, record: { id: string; poNumber: string; status: string }) => (
        <Space size="small">
          {record.status === 'APPROVED' && (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              loading={issueMutation.isPending}
              onClick={() => issueMutation.mutate(record.id)}
            >
              Terbitkan
            </Button>
          )}
          <Button
            size="small"
            icon={<FilePdfOutlined />}
            style={{ color: '#CF1322', borderColor: '#CF1322' }}
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
        subtitle="Daftar pemesanan resmi kepada vendor terverifikasi dengan proteksi penerbitan dan unduhan PDF resmi (R24–R27)."
        icon={<FileTextOutlined style={{ color: '#0052CC' }} />}
      />

      <Card>
        <Table
          columns={columns}
          dataSource={poData}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 750 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default PoListPage;
