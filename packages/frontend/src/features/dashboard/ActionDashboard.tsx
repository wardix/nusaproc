import React from 'react';
import { Card, Row, Col, Typography, Tag, Table, Button, Space, Statistic, theme } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { RoleTag } from '../../components/common/StatusTag';

const { Text } = Typography;

interface ActionTask {
  id: string;
  taskType: string;
  referenceNumber: string;
  description: string;
  amount?: number;
  slaRemainingMinutes: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  actionUrl: string;
}

export const ActionDashboard: React.FC = () => {
  const { token } = theme.useToken();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const activeRole = user?.activeRole || 'REQUESTER';

  // Role-oriented mock task queue for R56 Action-Oriented Dashboard
  const tasks: ActionTask[] = [
    {
      id: 'task-1',
      taskType: activeRole === 'APPROVER' ? 'Persetujuan PR' : 'Pemeriksaan Invoice',
      referenceNumber: 'PR-202608-0012',
      description: 'Pengadaan Router Edge BGP 10G untuk POP Medan',
      amount: 50_000_000,
      slaRemainingMinutes: 45,
      priority: 'HIGH',
      actionUrl: '/pr',
    },
    {
      id: 'task-2',
      taskType: activeRole === 'WAREHOUSE' ? 'Penerimaan Barang (BAST)' : 'Matching Exception Override',
      referenceNumber: 'PO-202608-0045',
      description: 'Penerimaan 50 Unit SFP+ 10G Transceiver',
      amount: 25_000_000,
      slaRemainingMinutes: 120,
      priority: 'MEDIUM',
      actionUrl: activeRole === 'WAREHOUSE' ? '/receipts' : '/invoices',
    },
  ];

  const columns = [
    {
      title: 'Tipe Aksi',
      dataIndex: 'taskType',
      key: 'taskType',
      render: (text: string) => <strong>{text}</strong>,
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
    },
    {
      title: 'Nominal',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount?: number) =>
        amount ? `Rp ${amount.toLocaleString('id-ID')}` : '-',
    },
    {
      title: 'Status SLA',
      dataIndex: 'slaRemainingMinutes',
      key: 'sla',
      render: (mins: number) => {
        const isUrgent = mins <= 60;
        return (
          <Tag
            color={isUrgent ? 'error' : 'warning'}
            icon={isUrgent ? <WarningOutlined /> : <ClockCircleOutlined />}
          >
            Sisa {mins} Menit
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
        tags={<RoleTag role={activeRole} />}
      />

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
              value={1}
              valueStyle={{ color: token.colorError }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Diselesaikan Hari Ini"
              value={8}
              valueStyle={{ color: token.colorSuccess }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Nilai Antrean"
              value="Rp 75 Juta"
              valueStyle={{ color: token.colorTextHeading }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Antrean Tugas Aksi & SLA (Action-Oriented Queue)">
        <Table
          dataSource={tasks}
          columns={columns}
          rowKey="id"
          pagination={false}
          scroll={{ x: 600 }}
        />
      </Card>
    </div>
  );
};

export default ActionDashboard;
