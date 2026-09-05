import React, { useMemo } from 'react';
import { Card, Row, Col, Typography, Tag, Table, Button, Space, Statistic, theme, Empty, Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  DollarOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { PageHeader } from '../../components/common/PageHeader';
import { RoleTag } from '../../components/common/StatusTag';
import { formatRupiah, formatRupiahCompact } from '../../utils/currency';
import { prApi } from '../../api/endpoints/pr';
import { poApi } from '../../api/endpoints/po';
import { invoiceApi } from '../../api/endpoints/invoice';
import { receiptApi } from '../../api/endpoints/receipt';
import { paymentApi } from '../../api/endpoints/payment';
import type { AppRole } from '@nusaproc/shared';

const { Text } = Typography;

export interface ActionTask {
  id: string;
  taskType: string;
  referenceNumber: string;
  description: string;
  amount?: number;
  slaRemainingMinutes: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  actionUrl: string;
  createdAt?: string;
}

/**
 * Calculates remaining SLA minutes from creation timestamp with SLA deadline in hours.
 */
export function calculateSlaRemainingMinutes(createdAtStr?: string, slaHours: number = 48): number {
  if (!createdAtStr) return 0;
  const createdTime = new Date(createdAtStr).getTime();
  if (isNaN(createdTime)) return 0;
  const deadline = createdTime + slaHours * 60 * 60 * 1000;
  const diffMinutes = Math.round((deadline - Date.now()) / (60 * 1000));
  return diffMinutes;
}

export const ActionDashboard: React.FC = () => {
  const { token } = theme.useToken();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeRole: AppRole = (user?.activeRole as AppRole) || 'REQUESTER';

  // 1. Fetch live transaction data across domains
  const { data: prData, isLoading: prLoading } = useQuery({
    queryKey: ['dashboard-prs'],
    queryFn: () => prApi.list().catch(() => ({ data: [] })),
  });

  const { data: poData, isLoading: poLoading } = useQuery({
    queryKey: ['dashboard-pos'],
    queryFn: () => poApi.list().catch(() => ({ data: [] })),
  });

  const { data: invoiceData, isLoading: invoiceLoading } = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: () => invoiceApi.list().catch(() => ({ data: [] })),
  });

  const { data: receiptData, isLoading: receiptLoading } = useQuery({
    queryKey: ['dashboard-receipts'],
    queryFn: () => receiptApi.list().catch(() => ({ data: [] })),
  });

  const { data: paymentData, isLoading: paymentLoading } = useQuery({
    queryKey: ['dashboard-payments'],
    queryFn: () => paymentApi.list().catch(() => ({ data: [] })),
  });

  const isGlobalLoading = prLoading || poLoading || invoiceLoading || receiptLoading || paymentLoading;

  const prList: any[] = prData?.data || [];
  const poList: any[] = poData?.data || [];
  const invoiceList: any[] = invoiceData?.data || [];
  const receiptList: any[] = receiptData?.data || [];
  const paymentList: any[] = paymentData?.data || [];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-prs'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-pos'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-invoices'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-receipts'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-payments'] });
  };

  // 2. Build live action tasks queue dynamically according to the active role (R56)
  const tasks: ActionTask[] = useMemo(() => {
    const list: ActionTask[] = [];

    if (activeRole === 'APPROVER') {
      // PRs needing approval
      const pendingPrs = prList.filter((pr) => pr.status === 'PENDING_APPROVAL' || pr.status === 'SUBMITTED');
      pendingPrs.forEach((pr) => {
        list.push({
          id: `pr-${pr.id}`,
          taskType: 'Persetujuan Purchase Request',
          referenceNumber: pr.prNumber,
          description: pr.businessJustification || (pr.divisionName ? `Pengadaan ${pr.divisionName}` : 'Persetujuan Pengadaan'),
          amount: Number(pr.totalEstimatedAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(pr.createdAt, 48),
          priority: pr.isEmergency ? 'HIGH' : Number(pr.totalEstimatedAmount) >= 50_000_000 ? 'HIGH' : 'MEDIUM',
          actionUrl: '/approvals/pr',
          createdAt: pr.createdAt,
        });
      });

      // POs needing approval
      const pendingPos = poList.filter((po) => po.status === 'DRAFT');
      pendingPos.forEach((po) => {
        list.push({
          id: `po-${po.id}`,
          taskType: 'Persetujuan Purchase Order',
          referenceNumber: po.poNumber,
          description: `Vendor: ${po.vendorName || '-'} (Persetujuan PO sebelum diterbitkan)`,
          amount: Number(po.grandTotalAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(po.createdAt, 48),
          priority: Number(po.grandTotalAmount) >= 50_000_000 ? 'HIGH' : 'MEDIUM',
          actionUrl: '/approvals/po',
          createdAt: po.createdAt,
        });
      });
    } else if (activeRole === 'ACCOUNT_PAYABLE') {
      // Approved PRs with remaining unfulfilled items waiting for PO issuance
      const approvedPrs = prList.filter(
        (pr) => pr.status === 'APPROVED' && (pr.remainingQuantity === undefined || Number(pr.remainingQuantity) > 0)
      );
      approvedPrs.forEach((pr) => {
        list.push({
          id: `pr-po-${pr.id}`,
          taskType: 'Terbitkan PO dari PR',
          referenceNumber: pr.prNumber,
          description: `${pr.businessJustification || 'PR disetujui, siap diterbitkan PO'} (Sisa item: ${pr.remainingQuantity ?? '-'})`,
          amount: Number(pr.totalEstimatedAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(pr.updatedAt || pr.createdAt, 24),
          priority: pr.isEmergency ? 'HIGH' : 'MEDIUM',
          actionUrl: `/po/create?prId=${pr.id}`,
          createdAt: pr.updatedAt || pr.createdAt,
        });
      });

      // POs approved waiting to be issued to vendor
      const approvedPos = poList.filter((po) => po.status === 'APPROVED');
      approvedPos.forEach((po) => {
        list.push({
          id: `po-issue-${po.id}`,
          taskType: 'Kirim (Issue) PO ke Vendor',
          referenceNumber: po.poNumber,
          description: `Vendor: ${po.vendorName || '-'} (PO telah disetujui, siap dikirim ke vendor)`,
          amount: Number(po.grandTotalAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(po.approvedAt || po.createdAt, 24),
          priority: 'MEDIUM',
          actionUrl: '/po',
          createdAt: po.approvedAt || po.createdAt,
        });
      });

      // Invoices with matching exceptions
      const exceptionInvoices = invoiceList.filter((inv) => inv.matchStatus === 'MATCHED_WITH_EXCEPTION');
      exceptionInvoices.forEach((inv) => {
        list.push({
          id: `inv-exc-${inv.id}`,
          taskType: 'Review Exception Invoice',
          referenceNumber: inv.vendorInvoiceNumber || inv.invoiceNumberInternal,
          description: 'Selisih matching invoice terdeteksi — butuh telaah/override Head of AP (R38)',
          amount: Number(inv.totalPayableAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(inv.createdAt, 24),
          priority: 'HIGH',
          actionUrl: '/invoices',
          createdAt: inv.createdAt,
        });
      });

      // Invoices unmatched
      const unmatchedInvoices = invoiceList.filter((inv) => inv.matchStatus === 'UNMATCHED');
      unmatchedInvoices.forEach((inv) => {
        list.push({
          id: `inv-unmatch-${inv.id}`,
          taskType: 'Pemeriksaan 2-Way Match',
          referenceNumber: inv.vendorInvoiceNumber || inv.invoiceNumberInternal,
          description: 'Invoice baru diunggah, jalankan verifikasi 2-Way Matching (R38)',
          amount: Number(inv.totalPayableAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(inv.createdAt, 24),
          priority: 'MEDIUM',
          actionUrl: '/invoices',
          createdAt: inv.createdAt,
        });
      });
    } else if (activeRole === 'WAREHOUSE') {
      // Issued POs waiting for Goods Receipt / BAST
      const issuedPos = poList.filter((po) => po.status === 'ISSUED');
      issuedPos.forEach((po) => {
        list.push({
          id: `po-rcpt-${po.id}`,
          taskType: 'Penerimaan Barang (BAST)',
          referenceNumber: po.poNumber,
          description: `Vendor: ${po.vendorName || '-'} | Menunggu penerimaan fisik barang & surat jalan`,
          amount: Number(po.grandTotalAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(po.issuedAt || po.createdAt, 48),
          priority: 'MEDIUM',
          actionUrl: `/receipts/create?poId=${po.id}`,
          createdAt: po.issuedAt || po.createdAt,
        });
      });
    } else if (activeRole === 'FINANCE') {
      // Invoices ready for payment proposal
      const readyInvoices = invoiceList.filter(
        (inv) => inv.matchStatus === 'MATCHED_OK' || inv.matchStatus === 'EXCEPTION_OVERRIDDEN'
      );
      readyInvoices.forEach((inv) => {
        list.push({
          id: `inv-pay-${inv.id}`,
          taskType: 'Buat Proposal Pembayaran',
          referenceNumber: inv.vendorInvoiceNumber || inv.invoiceNumberInternal,
          description: 'Invoice telah terverifikasi 2-Way Match, siap diajukan proposal pembayaran',
          amount: Number(inv.totalPayableAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(inv.createdAt, 24),
          priority: 'HIGH',
          actionUrl: '/payments',
          createdAt: inv.createdAt,
        });
      });

      // Payment proposals needing Checker review
      const proposedPayments = paymentList.filter((prop) => prop.status === 'PROPOSED');
      proposedPayments.forEach((prop) => {
        list.push({
          id: `prop-check-${prop.id}`,
          taskType: 'Verifikasi Proposal (Checker)',
          referenceNumber: prop.proposalNumber,
          description: 'Pemeriksaan kepatuhan 4-Eyes Principle oleh Checker (R42)',
          amount: Number(prop.totalPaymentAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(prop.proposedAt, 24),
          priority: 'HIGH',
          actionUrl: '/payments',
          createdAt: prop.proposedAt,
        });
      });

      // Payment proposals checked & waiting for execution
      const checkedPayments = paymentList.filter((prop) => prop.status === 'CHECKED');
      checkedPayments.forEach((prop) => {
        list.push({
          id: `prop-exec-${prop.id}`,
          taskType: 'Eksekusi Transfer Pembayaran',
          referenceNumber: prop.proposalNumber,
          description: 'Proposal telah di-check, siap dieksekusi transfer bank (R43)',
          amount: Number(prop.totalPaymentAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(prop.checkedAt || prop.proposedAt, 12),
          priority: 'HIGH',
          actionUrl: '/payments',
          createdAt: prop.checkedAt || prop.proposedAt,
        });
      });
    } else if (activeRole === 'REQUESTER') {
      // PRs in Draft
      const draftPrs = prList.filter(
        (pr) => pr.status === 'DRAFT' && (!user?.id || pr.requesterId === user?.id)
      );
      draftPrs.forEach((pr) => {
        list.push({
          id: `pr-draft-${pr.id}`,
          taskType: 'Pengajuan PR (Draft)',
          referenceNumber: pr.prNumber,
          description: pr.businessJustification || 'Draft PR belum diajukan untuk persetujuan',
          amount: Number(pr.totalEstimatedAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(pr.createdAt, 72),
          priority: 'LOW',
          actionUrl: '/pr',
          createdAt: pr.createdAt,
        });
      });

      // PRs Rejected
      const rejectedPrs = prList.filter(
        (pr) => pr.status === 'REJECTED' && (!user?.id || pr.requesterId === user?.id)
      );
      rejectedPrs.forEach((pr) => {
        list.push({
          id: `pr-rej-${pr.id}`,
          taskType: 'Revisi PR Ditolak',
          referenceNumber: pr.prNumber,
          description: 'PR ditolak oleh approver, periksa catatan dan revisi draft',
          amount: Number(pr.totalEstimatedAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(pr.updatedAt || pr.createdAt, 24),
          priority: 'HIGH',
          actionUrl: '/pr',
          createdAt: pr.updatedAt || pr.createdAt,
        });
      });

      // PRs Pending Approval (Waiting)
      const waitingPrs = prList.filter(
        (pr) => pr.status === 'PENDING_APPROVAL' && (!user?.id || pr.requesterId === user?.id)
      );
      waitingPrs.forEach((pr) => {
        list.push({
          id: `pr-wait-${pr.id}`,
          taskType: 'Status Menunggu Persetujuan',
          referenceNumber: pr.prNumber,
          description: 'PR sedang dalam proses persetujuan bertingkat (R9)',
          amount: Number(pr.totalEstimatedAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(pr.createdAt, 48),
          priority: 'LOW',
          actionUrl: '/pr',
          createdAt: pr.createdAt,
        });
      });
    } else {
      // ADMIN & AUDITOR: Aggregated overview across all pending workflows
      const pendingPrs = prList.filter((pr) => pr.status === 'PENDING_APPROVAL' || pr.status === 'SUBMITTED');
      pendingPrs.forEach((pr) => {
        list.push({
          id: `admin-pr-${pr.id}`,
          taskType: 'Persetujuan PR (Pending)',
          referenceNumber: pr.prNumber,
          description: pr.businessJustification || 'Menunggu persetujuan berjenjang',
          amount: Number(pr.totalEstimatedAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(pr.createdAt, 48),
          priority: pr.isEmergency ? 'HIGH' : 'MEDIUM',
          actionUrl: '/approvals/pr',
          createdAt: pr.createdAt,
        });
      });

      const pendingPos = poList.filter((po) => po.status === 'DRAFT');
      pendingPos.forEach((po) => {
        list.push({
          id: `admin-po-${po.id}`,
          taskType: 'Persetujuan PO (Draft)',
          referenceNumber: po.poNumber,
          description: `Vendor: ${po.vendorName || '-'} | Menunggu persetujuan PO`,
          amount: Number(po.grandTotalAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(po.createdAt, 48),
          priority: 'MEDIUM',
          actionUrl: '/approvals/po',
          createdAt: po.createdAt,
        });
      });

      const exceptionInvoices = invoiceList.filter((inv) => inv.matchStatus === 'MATCHED_WITH_EXCEPTION');
      exceptionInvoices.forEach((inv) => {
        list.push({
          id: `admin-inv-${inv.id}`,
          taskType: 'Review Exception Invoice',
          referenceNumber: inv.vendorInvoiceNumber || inv.invoiceNumberInternal,
          description: 'Selisih matching invoice terdeteksi',
          amount: Number(inv.totalPayableAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(inv.createdAt, 24),
          priority: 'HIGH',
          actionUrl: '/invoices',
          createdAt: inv.createdAt,
        });
      });

      const pendingPayments = paymentList.filter((prop) => prop.status === 'PROPOSED' || prop.status === 'CHECKED');
      pendingPayments.forEach((prop) => {
        list.push({
          id: `admin-prop-${prop.id}`,
          taskType: prop.status === 'PROPOSED' ? 'Verifikasi Proposal (Checker)' : 'Eksekusi Transfer Pembayaran',
          referenceNumber: prop.proposalNumber,
          description: `Status: ${prop.status} | Menunggu penyelesaian pembayaran`,
          amount: Number(prop.totalPaymentAmount) || 0,
          slaRemainingMinutes: calculateSlaRemainingMinutes(prop.proposedAt, 24),
          priority: 'HIGH',
          actionUrl: '/payments',
          createdAt: prop.proposedAt,
        });
      });
    }

    // Sort by urgent SLA first (ascending remaining minutes)
    return list.sort((a, b) => a.slaRemainingMinutes - b.slaRemainingMinutes);
  }, [activeRole, prList, poList, invoiceList, receiptList, paymentList, user?.id]);

  // 3. Dynamic KPI Calculation
  const urgentTasksCount = tasks.filter((t) => t.slaRemainingMinutes <= 60).length;
  const totalQueueAmount = tasks.reduce((sum, t) => sum + (t.amount || 0), 0);

  const completedCount = useMemo(() => {
    if (activeRole === 'APPROVER') {
      return (
        prList.filter((p) => p.status === 'APPROVED').length +
        poList.filter((p) => p.status === 'APPROVED' || p.status === 'ISSUED').length
      );
    }
    if (activeRole === 'ACCOUNT_PAYABLE') {
      return (
        poList.filter((p) => p.status === 'ISSUED').length +
        invoiceList.filter((i) => i.matchStatus === 'MATCHED_OK' || i.matchStatus === 'EXCEPTION_OVERRIDDEN').length
      );
    }
    if (activeRole === 'WAREHOUSE') {
      return receiptList.length;
    }
    if (activeRole === 'FINANCE') {
      return paymentList.filter((p) => p.status === 'EXECUTED').length;
    }
    if (activeRole === 'REQUESTER') {
      return prList.filter((p) => p.status === 'APPROVED' && (!user?.id || p.requesterId === user?.id)).length;
    }
    // Admin / Auditor
    return (
      prList.filter((p) => p.status === 'APPROVED').length +
      poList.filter((p) => p.status === 'ISSUED').length +
      paymentList.filter((p) => p.status === 'EXECUTED').length
    );
  }, [activeRole, prList, poList, invoiceList, receiptList, paymentList, user?.id]);

  const columns = [
    {
      title: 'Tipe Aksi',
      dataIndex: 'taskType',
      key: 'taskType',
      render: (text: string, record: ActionTask) => {
        let priorityColor = 'default';
        let priorityLabel = 'Normal';
        if (record.priority === 'HIGH') {
          priorityColor = 'error';
          priorityLabel = 'Mendesak';
        } else if (record.priority === 'MEDIUM') {
          priorityColor = 'warning';
          priorityLabel = 'Sedang';
        }

        return (
          <Space direction="vertical" size={2}>
            <strong>{text}</strong>
            <Tag color={priorityColor} style={{ fontSize: 11, lineHeight: '18px' }}>
              {priorityLabel}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: 'No. Referensi',
      dataIndex: 'referenceNumber',
      key: 'referenceNumber',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Deskripsi',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Nominal',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount?: number) => (amount ? <Text strong>{formatRupiah(amount)}</Text> : '-'),
    },
    {
      title: 'Status SLA',
      dataIndex: 'slaRemainingMinutes',
      key: 'sla',
      render: (mins: number) => {
        if (mins <= 0) {
          return (
            <Tag color="error" icon={<WarningOutlined />}>
              Lewat SLA ({Math.abs(mins)} mnt)
            </Tag>
          );
        }
        const isUrgent = mins <= 60;
        const isWarning = mins <= 720;
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        const timeText = hours > 0 ? `${hours} jam ${remMins > 0 ? `${remMins} mnt` : ''}` : `${remMins} mnt`;

        return (
          <Tag
            color={isUrgent ? 'error' : isWarning ? 'warning' : 'cyan'}
            icon={isUrgent ? <WarningOutlined /> : <ClockCircleOutlined />}
          >
            Sisa {timeText}
          </Tag>
        );
      },
    },
    {
      title: 'Tindakan',
      key: 'action',
      render: (_: unknown, record: ActionTask) => (
        <Button
          type="primary"
          size="small"
          icon={<ArrowRightOutlined />}
          onClick={() => navigate(record.actionUrl)}
        >
          Proses Sekarang
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title={`Dashboard Aksi — ${user?.fullName || 'Pengguna'}`}
        subtitle="Fokus pada antrean tugas yang memerlukan aksi segera (R56)."
        tags={
          <Space>
            <RoleTag role={activeRole} />
            <Tooltip title="Muat Ulang Data">
              <Button size="small" icon={<ReloadOutlined />} onClick={handleRefresh} loading={isGlobalLoading}>
                Segarkan
              </Button>
            </Tooltip>
          </Space>
        }
      />

      {/* KPI Statistic Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tugas Menunggu Tindakan"
              value={tasks.length}
              valueStyle={{ color: token.colorPrimary }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="SLA Mendekati Batas (< 1 Jam)"
              value={urgentTasksCount}
              valueStyle={{ color: urgentTasksCount > 0 ? token.colorError : token.colorTextSecondary }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Transaksi Diselesaikan"
              value={completedCount}
              valueStyle={{ color: token.colorSuccess }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Nilai Antrean"
              value={formatRupiahCompact(totalQueueAmount)}
              valueStyle={{ color: token.colorTextHeading }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Action-Oriented Task Queue */}
      <Card
        title={
          <Space>
            <span>Antrean Tugas Aksi & SLA (Action-Oriented Queue)</span>
            <Tag color="processing">{tasks.length} item perlu tindakan</Tag>
          </Space>
        }
        extra={
          activeRole === 'AUDITOR' && (
            <Button size="small" icon={<AuditOutlined />} onClick={() => navigate('/audit')}>
              Lihat Jejak Audit
            </Button>
          )
        }
      >
        <Table
          dataSource={tasks}
          columns={columns}
          rowKey="id"
          loading={isGlobalLoading}
          pagination={tasks.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
          scroll={{ x: 750 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Tidak ada tugas mendesak untuk peran ini. Semua transaksi tertangani dengan baik."
              />
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default ActionDashboard;
