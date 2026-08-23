import React, { useState } from 'react';
import { Table, Button, Tag, Space, Card, Typography, Modal, Input, notification } from 'antd';
import { PlusOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { prApi } from '../../../api/endpoints/pr';
import { formatRupiah } from '../../../utils/currency';
import { useAuthStore } from '../../../stores/useAuthStore';

const { Title, Text } = Typography;

export const PrListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedPrId, setSelectedPrId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-requests'],
    queryFn: () => prApi.list(),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => prApi.submit(id),
    onSuccess: () => {
      notification.success({ message: 'Purchase Request berhasil diajukan untuk persetujuan (R9).' });
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
    },
    onError: (err: Error) => {
      notification.error({ message: 'Gagal mengajukan PR', description: err.message });
    },
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: 'APPROVED' | 'REJECTED'; reason?: string }) =>
      prApi.decide(id, {
        decision,
        rejectionReason: reason,
        approverMaxLimit: 100000000,
        approverDivisionId: user?.divisionId,
      }),
    onSuccess: (_, variables) => {
      notification.success({
        message: variables.decision === 'APPROVED' ? 'PR Disetujui (R13).' : 'PR Ditolak.',
      });
      setRejectModalOpen(false);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
    },
    onError: (err: Error) => {
      notification.error({ message: 'Gagal memproses persetujuan PR', description: err.message });
    },
  });

  const prList = data?.data || [];

  const columns = [
    {
      title: 'Nomor PR',
      dataIndex: 'prNumber',
      key: 'prNumber',
      render: (text: string) => <Text strong style={{ color: '#0052CC' }}>{text}</Text>,
    },
    {
      title: 'Cost Center',
      dataIndex: 'costCenter',
      key: 'costCenter',
    },
    {
      title: 'Divisi',
      dataIndex: 'divisionId',
      key: 'divisionId',
    },
    {
      title: 'Termin Pembayaran',
      dataIndex: 'paymentTermType',
      key: 'paymentTermType',
      render: (term: string) => (
        <Tag color={term === 'PAY_AFTER_RECEIPT' ? 'blue' : 'orange'}>
          {term === 'PAY_AFTER_RECEIPT' ? 'Pay After Receipt' : 'Advance / COD'}
        </Tag>
      ),
    },
    {
      title: 'Estimasi Nilai',
      dataIndex: 'totalEstimatedAmount',
      key: 'totalEstimatedAmount',
      render: (val: number) => <Text strong>{formatRupiah(Number(val) || 0)}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          DRAFT: 'default',
          SUBMITTED: 'processing',
          APPROVED: 'success',
          REJECTED: 'error',
          CLOSED_PARTIAL: 'warning',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      render: (_: unknown, record: { id: string; status: string }) => (
        <Space size="small">
          {record.status === 'DRAFT' && (
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              loading={submitMutation.isPending}
              onClick={() => submitMutation.mutate(record.id)}
            >
              Ajukan
            </Button>
          )}
          {record.status === 'SUBMITTED' && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                style={{ background: '#389E0D', borderColor: '#389E0D' }}
                loading={decideMutation.isPending}
                onClick={() => decideMutation.mutate({ id: record.id, decision: 'APPROVED' })}
              >
                Setujui
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => {
                  setSelectedPrId(record.id);
                  setRejectModalOpen(true);
                }}
              >
                Tolak
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>
              Daftar Permintaan Pembelian (Purchase Request)
            </Title>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/pr/create')}
              style={{ background: '#0052CC' }}
            >
              Buat PR Baru
            </Button>
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={prList}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="Tolak Permintaan Pembelian"
        open={rejectModalOpen}
        onOk={() => {
          if (selectedPrId && rejectionReason) {
            decideMutation.mutate({ id: selectedPrId, decision: 'REJECTED', reason: rejectionReason });
          }
        }}
        onCancel={() => {
          setRejectModalOpen(false);
          setRejectionReason('');
        }}
        okText="Konfirmasi Penolakan"
        okButtonProps={{ danger: true, disabled: !rejectionReason }}
      >
        <Text>Masukkan alasan penolakan purchase request secara terperinci:</Text>
        <Input.TextArea
          rows={4}
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="Contoh: Estimasi anggaran melebihi alokasi CAPEX Q3"
          style={{ marginTop: 12 }}
        />
      </Modal>
    </div>
  );
};

export default PrListPage;
