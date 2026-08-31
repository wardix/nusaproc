import React from 'react';
import { Table, Button, Space, Card, Typography, App, theme } from 'antd';
import { CheckOutlined, ThunderboltOutlined, DollarCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentApi } from '../../../api/endpoints/payment';
import { formatRupiah } from '../../../utils/currency';
import { PaymentWorkflowSteps } from '../components/PaymentWorkflowSteps';
import { useReauthStore } from '../../../stores/useReauthStore';
import { PageHeader } from '../../../components/common/PageHeader';
import { StatusTag } from '../../../components/common/StatusTag';

const { Text } = Typography;

export const PaymentListPage: React.FC = () => {
  const { notification } = App.useApp();
  const { token } = theme.useToken();
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
      render: (text: string) => <Text strong style={{ color: token.colorPrimary }}>{text}</Text>,
    },
    {
      title: 'Vendor Penerima',
      dataIndex: 'vendorName',
      key: 'vendorName',
      render: (name: string) => name || 'PT Fiber Optik Nusantara',
    },
    {
      title: 'Rekening Tujuan',
      dataIndex: 'targetBankAccount',
      key: 'targetBankAccount',
      render: (acc: string) => acc || 'BCA ••••••••890',
    },
    {
      title: 'Nominal Transfer',
      dataIndex: 'paymentAmount',
      key: 'paymentAmount',
      render: (val: number) => <Text strong>{formatRupiah(Number(val) || 0)}</Text>,
    },
    {
      title: 'Status Proposal',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusTag status={status} category="payment" />,
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
              style={{ background: token.colorWarning, borderColor: token.colorWarning }}
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
              style={{ background: token.colorSuccess, borderColor: token.colorSuccess }}
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
      <PageHeader
        title="Daftar Proposal Pembayaran (Maker-Checker-Executor R41–R45)"
        subtitle="Alur persetujuan pencairan dana terpisah (SoD) dan proteksi eksekusi transfer dengan Re-autentikasi (R43)."
        icon={<DollarCircleOutlined style={{ color: token.colorPrimary }} />}
      />

      <Card title="Alur Persetujuan Pembayaran (Maker-Checker-Executor R42)">
        <PaymentWorkflowSteps
          status={proposals[0]?.status || 'PROPOSED'}
          makerName="Dewi Lestari (AP Maker)"
          checkerName="Hendra Wijaya (Head of AP)"
          executorName="Rina Kartika (Finance Treasury)"
        />
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={proposals}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 750 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default PaymentListPage;
