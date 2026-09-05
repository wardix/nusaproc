import React, { useState, useMemo } from 'react';
import { Table, Button, Tag, Space, Card, Typography, Modal, Input, App, theme, Tooltip, type TableProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined, ShoppingCartOutlined, UserOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { prApi } from '../../../api/endpoints/pr';
import { divisionsApi } from '../../../api/endpoints/organization';
import { formatRupiah } from '../../../utils/currency';
import { formatDate } from '../../../utils/date';
import { useAuthStore } from '../../../stores/useAuthStore';
import { PageHeader } from '../../../components/common/PageHeader';
import { StatusTag } from '../../../components/common/StatusTag';

const { Text } = Typography;

export interface PurchaseRequestRow {
  id: string;
  prNumber: string;
  requesterId: string;
  requesterName?: string;
  requesterEmail?: string;
  costCenter: string;
  divisionId: string;
  divisionName?: string;
  branchId: string;
  branchName?: string;
  requiredDate: string;
  paymentTermType: string;
  status: string;
  totalEstimatedAmount: number;
  remainingQuantity?: number;
  poCount?: number;
  createdAt: string;
  updatedAt: string;
}

const FALLBACK_DIVISION_NAMES: Record<string, string> = {
  'DIV-IT': 'Divisi Teknologi Informasi & Infrastruktur',
  'DIV-OPS': 'Divisi Operasional & Jaringan',
  'DIV-FIN': 'Divisi Keuangan & Akuntansi',
  'DIV-LOG': 'Divisi Logistik & Pengadaan',
  'DIV-GEN': 'Divisi Umum & SDM',
  '4': 'Divisi Teknologi Informasi & Infrastruktur',
  '1': 'Divisi Operasional & Jaringan',
  '2': 'Divisi Keuangan & Akuntansi',
  '3': 'Divisi Logistik & Pengadaan',
  '5': 'Divisi Umum & SDM',
};

export const PrListPage: React.FC = () => {
  const { notification } = App.useApp();
  const { token } = theme.useToken();
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

  const { data: divisionsData } = useQuery({
    queryKey: ['divisions', true],
    queryFn: () => divisionsApi.list({ isActive: true }).catch(() => ({ data: [] })),
  });

  const activeDivisions = divisionsData?.data || [];

  const divisionNameMap = useMemo(() => {
    const map = new Map<string, string>();
    // Seed fallback defaults
    Object.entries(FALLBACK_DIVISION_NAMES).forEach(([k, v]) => map.set(k, v));
    // Overlay database master division names
    activeDivisions.forEach((d) => {
      map.set(d.code, d.name);
      map.set(d.id, d.name);
    });
    return map;
  }, [activeDivisions]);

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
        approverMaxLimit: user?.activeRole === 'ADMIN' ? 999_999_999_999 : 100_000_000,
        approverDivisionId: user?.activeRole === 'ADMIN' ? undefined : user?.divisionId,
      }),
    onSuccess: (_, variables) => {
      notification.success({
        message: variables.decision === 'APPROVED' ? 'PR Disetujui (R13).' : 'PR Ditolak.',
      });
      setRejectModalOpen(false);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.detail || err?.message || 'Gagal memproses persetujuan PR';
      notification.error({ message: 'Persetujuan PR Ditolak Sistem', description: errMsg });
    },
  });

  const prList: PurchaseRequestRow[] = data?.data || [];

  const columns: ColumnsType<PurchaseRequestRow> = [
    {
      title: 'Nomor PR',
      dataIndex: 'prNumber',
      key: 'prNumber',
      render: (text: string) => <Text strong style={{ color: token.colorPrimary }}>{text}</Text>,
    },
    {
      title: 'Tgl Pengajuan',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      render: (date: string) => <Text>{formatDate(date)}</Text>,
    },
    {
      title: 'Pemohon (Requester)',
      key: 'requester',
      render: (_: unknown, record: PurchaseRequestRow) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.requesterName || record.requesterEmail || 'Requester'}</Text>
          {record.requesterEmail && record.requesterName && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.requesterEmail}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Divisi & Unit Pengaju',
      key: 'division',
      render: (_: unknown, record: PurchaseRequestRow) => {
        const resolvedName =
          record.divisionName ||
          divisionNameMap.get(record.divisionId) ||
          FALLBACK_DIVISION_NAMES[record.divisionId] ||
          record.divisionId ||
          '-';

        return (
          <Space direction="vertical" size={0}>
            <Text strong>{resolvedName}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.costCenter ? `Cost Center: ${record.costCenter}` : (record.divisionId ? `Kode: ${record.divisionId}` : '')}
            </Text>
          </Space>
        );
      },
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
      render: (status: string) => <StatusTag status={status} category="pr" />,
    },
    {
      title: 'Aksi',
      key: 'action',
      render: (_: unknown, record: PurchaseRequestRow) => {
        const isSelfRequester = Boolean(record.requesterId && user?.id && record.requesterId === user.id);

        return (
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
                {isSelfRequester ? (
                  <Tooltip title="Pelanggaran SoD (R15): Anda adalah pembuat PR ini. Persetujuan harus dilakukan oleh akun Approver lain.">
                    <Button
                      type="primary"
                      size="small"
                      disabled
                      icon={<CheckCircleOutlined />}
                    >
                      Setujui
                    </Button>
                  </Tooltip>
                ) : (
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    loading={decideMutation.isPending}
                    onClick={() => decideMutation.mutate({ id: record.id, decision: 'APPROVED' })}
                  >
                    Setujui
                  </Button>
                )}
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
            {record.status === 'APPROVED' && (
              record.remainingQuantity !== undefined && record.remainingQuantity <= 0 ? (
                <Tag color="cyan">PO Sudah Diterbitkan</Tag>
              ) : (
                <Button
                  type="dashed"
                  size="small"
                  icon={<ShoppingCartOutlined />}
                  onClick={() => navigate(`/po/create?prId=${record.id}`)}
                >
                  Terbitkan PO
                </Button>
              )
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Daftar Permintaan Pembelian (Purchase Request)"
        subtitle="Kelola dan pantau seluruh pengajuan pengadaan barang/jasa dari unit kerja."
        icon={<ShoppingCartOutlined style={{ color: token.colorPrimary }} />}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/pr/create')}
          >
            Buat PR Baru
          </Button>
        }
      />

      <Card>
        <Table
          columns={columns}
          dataSource={prList}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1000 }}
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
