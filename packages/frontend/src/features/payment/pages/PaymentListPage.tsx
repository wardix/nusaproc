import React from 'react';
import { Table, Button, Tag, Space, Card, Typography, notification } from 'antd';
import { CheckOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentApi } from '../../../api/endpoints/payment';
import { formatRupiah } from '../../../utils/currency';
import { PaymentWorkflowSteps } from '../components/PaymentWorkflowSteps';
import { useReauthStore } from '../../../stores/useReauthStore';

const { Title, Text } = Typography;

export const PaymentListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { openModal } = useReauthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['payment-proposals'],
    queryFn: () => paymentApi.list(),
  });

  const checkMutation = useMutation({
    mutationFn: (id: string) => paymentApi.check(id),
    onSuccess: () => {
      notification.success({ message: 'Proposal pembayaran telah diperiksa (Stage Checker) (R42).' });
      queryClient.invalidateQueries({ queryKey: ['payment-proposals'] });
    },
    onError: (err: Error) => {
      notification.error({ message: 'Gagal memeriksa proposal pembayaran', description: err.message });
    },
  });

  const executeMutation = useMutation({
    mutationFn: ({ id, reauthToken }: { id: string; reauthToken: string }) =>
      paymentApi.execute(
        id,
        { bankReferenceNumber: `TRX-${Date.now().toString().slice(-6)}` },
        reauthToken,
        `IDEMP-${id}`
      ),
    onSuccess: () => {
      notification.success({ message: 'Pembayaran berhasil dieksekusi via transfer bank (R43).' });
      queryClient.invalidateQueries({ queryKey: ['payment-proposals'] });
    },
    onError: (err: Error) => {
      notification.error({ message: 'Gagal mengeksekusi pembayaran', description: err.message });
    },
  });

  const handleExecutePayment = (id: string) => {
    openModal({
      targetAction: 'EXECUTE_PAYMENT',
      errorDetail: 'Tindakan eksekusi transfer dana memerlukan verifikasi Step-Up Re-Authentication (R5, R43).',
    });
    executeMutation.mutate({ id, reauthToken: useReauthStore.getState().lastReauthToken || 'DEV_STEP_UP_TOKEN' });
  };

  const proposals = data?.data || [];

  const columns = [
    {
      title: 'Nomor Proposal',
      dataIndex: 'proposalNumber',
      key: 'proposalNumber',
      render: (text: string) => <Text strong style={{ color: '#0052CC' }}>{text}</Text>,
    },
    {
      title: 'Metode Pembayaran',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (method: string) => <Tag color="blue">{method || 'BANK_TRANSFER'}</Tag>,
    },
    {
      title: 'Total Pembayaran',
      dataIndex: 'totalPaymentAmount',
      key: 'totalPaymentAmount',
      render: (val: number) => <Text strong>{formatRupiah(Number(val) || 0)}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          PROPOSED: 'processing',
          CHECKED: 'warning',
          EXECUTED: 'success',
          REJECTED: 'error',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      render: (_: unknown, record: { id: string; status: string }) => (
        <Space size="small">
          {record.status === 'PROPOSED' && (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              style={{ background: '#D48806', borderColor: '#D48806' }}
              loading={checkMutation.isPending}
              onClick={() => checkMutation.mutate(record.id)}
            >
              Periksa (Checker)
            </Button>
          )}
          {record.status === 'CHECKED' && (
            <Button
              type="primary"
              size="small"
              icon={<ThunderboltOutlined />}
              style={{ background: '#389E0D', borderColor: '#389E0D' }}
              loading={executeMutation.isPending}
              onClick={() => handleExecutePayment(record.id)}
            >
              Eksekusi Transfer (R43)
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card title="Alur Persetujuan Pembayaran (Maker-Checker-Executor R42)">
        <PaymentWorkflowSteps
          status={proposals[0]?.status || 'PROPOSED'}
          makerName="Dewi Lestari (AP Maker)"
          checkerName="Hendra Wijaya (Head of AP)"
          executorName="Rina Kartika (Finance Treasury)"
        />
      </Card>

      <Card
        title={
          <Title level={4} style={{ margin: 0 }}>
            Daftar Proposal Pembayaran
          </Title>
        }
      >
        <Table
          columns={columns}
          dataSource={proposals}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default PaymentListPage;
