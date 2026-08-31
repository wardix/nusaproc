import React, { useState } from 'react';
import { Table, Tag, Card, Typography, Row, Col, Input, Select, Space, Badge, theme } from 'antd';
import { WarningOutlined, SearchOutlined, AuditOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { receiptApi } from '../../../api/endpoints/receipt';
import { PageHeader } from '../../../components/common/PageHeader';
import { StatusTag } from '../../../components/common/StatusTag';
import { formatDateTime } from '../../../utils/date';

const { Text, Paragraph } = Typography;

export interface NcrItem {
  id: string;
  ncrNumber: string;
  grId: string;
  poId: string;
  description: string;
  actionRequired: string;
  isResolved: boolean;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export const NcrListPage: React.FC = () => {
  const { token } = theme.useToken();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ['ncrs', statusFilter],
    queryFn: () => receiptApi.listNcrs({ isResolved: statusFilter }),
  });

  const rawNcrs: NcrItem[] = data?.data || [];

  const filteredNcrs = rawNcrs.filter((ncr) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      ncr.ncrNumber.toLowerCase().includes(term) ||
      ncr.poId.toLowerCase().includes(term) ||
      ncr.description.toLowerCase().includes(term) ||
      ncr.actionRequired.toLowerCase().includes(term)
    );
  });

  const columns = [
    {
      title: 'Nomor Tiket NCR',
      dataIndex: 'ncrNumber',
      key: 'ncrNumber',
      render: (ncrNumber: string) => (
        <Space>
          <WarningOutlined style={{ color: token.colorWarning, fontSize: 16 }} />
          <Text strong style={{ color: token.colorWarning }}>
            {ncrNumber}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Dokumen Terkait',
      key: 'relatedDocs',
      render: (_: unknown, record: NcrItem) => (
        <Space direction="vertical" size={2}>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              PO ID:
            </Text>{' '}
            <Tag color="blue">{record.poId.slice(0, 8)}...</Tag>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              BAST ID:
            </Text>{' '}
            <Tag color="cyan">{record.grId.slice(0, 8)}...</Tag>
          </div>
        </Space>
      ),
    },
    {
      title: 'Deskripsi Masalah & Ketidaksesuaian',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string) => (
        <Paragraph style={{ margin: 0 }} ellipsis={{ rows: 2, tooltip: desc }}>
          {desc}
        </Paragraph>
      ),
    },
    {
      title: 'Tindakan yang Diperlukan',
      dataIndex: 'actionRequired',
      key: 'actionRequired',
      ellipsis: true,
      render: (action: string) => (
        <Text style={{ color: token.colorTextSecondary, fontSize: 13 }}>
          {action}
        </Text>
      ),
    },
    {
      title: 'Status Tiket',
      dataIndex: 'isResolved',
      key: 'isResolved',
      render: (resolved: boolean) => <StatusTag status={resolved} category="ncr" />,
    },
    {
      title: 'Tanggal Pencatatan',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (dateStr: string) => (
        <Text style={{ fontSize: 12 }}>
          {formatDateTime(dateStr)}
        </Text>
      ),
    },
  ];

  const openCount = rawNcrs.filter((n) => !n.isResolved).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Laporan Ketidaksesuaian Barang / Non-Conformance Reports (NCR) (R30, US5)"
        subtitle="Daftar insiden barang rusak, ditolak, atau tidak sesuai spesifikasi yang dicatat saat penerimaan BAST oleh Gudang / Pemohon."
        icon={<AuditOutlined style={{ color: token.colorWarning }} />}
        extra={
          <Badge count={openCount} overflowCount={99}>
            <Tag color="warning" style={{ padding: '4px 12px', fontSize: 13 }}>
              Tiket Open: {openCount}
            </Tag>
          </Badge>
        }
      />

      <Card>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Cari nomor NCR, PO ID, deskripsi..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Status Resolusi"
              style={{ width: '100%' }}
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Select.Option value={false}>Open / Dalam Investigasi</Select.Option>
              <Select.Option value={true}>Selesai / Resolved</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredNcrs}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10, showTotal: (total) => `Total ${total} laporan NCR` }}
        />
      </Card>
    </div>
  );
};

export default NcrListPage;
