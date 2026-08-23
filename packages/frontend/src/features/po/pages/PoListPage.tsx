import React from 'react';
import { Table, Button, Tag, Space, Card, Typography, notification } from 'antd';
import { FilePdfOutlined, CheckOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { poApi } from '../../../api/endpoints/po';
import { formatRupiah } from '../../../utils/currency';

const { Title, Text } = Typography;

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
      notification.success({ message: `Dokumen PDF ${poNumber} berhasil diunduh.` });
    } catch (err: unknown) {
      notification.error({ message: 'Gagal mengunduh PDF', description: (err as Error).message });
    }
  };

  const poData = data?.data ? [data.data] : [];

  const columns = [
    {
      title: 'Nomor PO',
      dataIndex: 'poNumber',
      key: 'poNumber',
      render: (text: string) => <Text strong style={{ color: '#0052CC' }}>{text}</Text>,
    },
    {
      title: 'Termin Pembayaran',
      dataIndex: 'paymentTermType',
      key: 'paymentTermType',
      render: (term: string) => <Tag color="blue">{term || 'PAY_AFTER_RECEIPT'}</Tag>,
    },
    {
      title: 'Grand Total',
      dataIndex: 'grandTotalAmount',
      key: 'grandTotalAmount',
      render: (val: number) => <Text strong>{formatRupiah(Number(val) || 0)}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          DRAFT: 'default',
          APPROVED: 'processing',
          ISSUED: 'success',
          AMENDED: 'warning',
          CANCELLED: 'error',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
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
    <Card
      title={
        <Title level={4} style={{ margin: 0 }}>
          Katalog Surat Pesanan (Purchase Order)
        </Title>
      }
    >
      <Table
        columns={columns}
        dataSource={poData}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
};

export default PoListPage;
