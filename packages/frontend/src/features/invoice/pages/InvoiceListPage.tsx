import React, { useState } from 'react';
import { Table, Button, Tag, Space, Card, Typography, Modal, Input, Drawer, notification } from 'antd';
import { SyncOutlined, CheckCircleOutlined, WarningOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceApi } from '../../../api/endpoints/invoice';
import { formatRupiah } from '../../../utils/currency';
import { TwoWayMatcherScreen } from '../components/TwoWayMatcherScreen';

const { Title, Text } = Typography;

export interface InvoiceItem {
  id: string;
  vendorInvoiceNumber: string;
  invoiceNumberInternal?: string;
  nsfpOriginal?: string;
  totalPayableAmount: number;
  subtotalAmount?: number;
  matchStatus: string;
  poNumber?: string;
  poId?: string;
  invoiceDate?: string;
  items?: Array<{ itemName: string; quantity: number; unitPrice: number; subtotal: number }>;
}

export const InvoiceListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [matcherInvoice, setMatcherInvoice] = useState<InvoiceItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.list(),
  });

  const matchMutation = useMutation({
    mutationFn: (id: string) => invoiceApi.runMatch(id),
    onSuccess: (result) => {
      const status = result?.data?.matchStatus;
      if (status === 'MATCHED_OK') {
        notification.success({ message: '2-Way Matching Sesuai (MATCHED_OK) (R38).' });
      } else if (status === 'MATCHED_WITH_EXCEPTION') {
        notification.warning({
          message: 'Matching Memiliki Selisih (MATCHED_WITH_EXCEPTION) (R38)',
          description: 'Memerlukan persetujuan Head of AP sebelum dapat diproses ke pembayaran.',
        });
      } else {
        notification.info({ message: `Hasil matching: ${status}` });
      }
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: Error) => {
      notification.error({ message: 'Gagal menjalankan 2-Way Matching', description: err.message });
    },
  });

  const overrideMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      invoiceApi.overrideException(id, reason),
    onSuccess: () => {
      notification.success({ message: 'Selisih invoice berhasil dioverride oleh Head of AP (R39).' });
      setOverrideModalOpen(false);
      setOverrideReason('');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: Error) => {
      notification.error({ message: 'Gagal melakukan override', description: err.message });
    },
  });

  const invoices: InvoiceItem[] = data?.data || [];

  const columns = [
    {
      title: 'Nomor Invoice Vendor',
      dataIndex: 'vendorInvoiceNumber',
      key: 'vendorInvoiceNumber',
      render: (text: string, record: InvoiceItem) => (
        <a onClick={() => setMatcherInvoice(record)}>
          <Text strong style={{ color: '#0052CC', cursor: 'pointer' }}>
            {text}
          </Text>
        </a>
      ),
    },
    {
      title: 'Nomor Internal',
      dataIndex: 'invoiceNumberInternal',
      key: 'invoiceNumberInternal',
    },
    {
      title: 'NSFP Faktur Pajak',
      dataIndex: 'nsfpOriginal',
      key: 'nsfpOriginal',
      render: (nsfp: string) => <Tag color="cyan">{nsfp || '-'}</Tag>,
    },
    {
      title: 'Total Tagihan',
      dataIndex: 'totalPayableAmount',
      key: 'totalPayableAmount',
      render: (val: number) => <Text strong>{formatRupiah(Number(val) || 0)}</Text>,
    },
    {
      title: 'Status 2-Way Matching',
      dataIndex: 'matchStatus',
      key: 'matchStatus',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          UNMATCHED: 'default',
          MATCHED_OK: 'success',
          MATCHED_WITH_EXCEPTION: 'warning',
          EXCEPTION_OVERRIDDEN: 'blue',
        };
        return (
          <Tag color={colorMap[status] || 'default'} icon={status === 'MATCHED_OK' ? <CheckCircleOutlined /> : <WarningOutlined />}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      render: (_: unknown, record: InvoiceItem) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setMatcherInvoice(record)}
          >
            Matcher
          </Button>
          <Button
            size="small"
            icon={<SyncOutlined />}
            loading={matchMutation.isPending}
            onClick={() => matchMutation.mutate(record.id)}
          >
            Match Ulang
          </Button>
          {record.matchStatus === 'MATCHED_WITH_EXCEPTION' && (
            <Button
              type="primary"
              size="small"
              style={{ background: '#D48806', borderColor: '#D48806' }}
              onClick={() => {
                setSelectedInvoiceId(record.id);
                setOverrideModalOpen(true);
              }}
            >
              Override (Head of AP)
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <Title level={4} style={{ margin: 0 }}>
            Verifikasi Tagihan Vendor & 2-Way Matching Engine (R33–R40)
          </Title>
        }
      >
        <Table
          columns={columns}
          dataSource={invoices}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="Override Selisih 2-Way Matching (R39)"
        open={overrideModalOpen}
        onOk={() => {
          if (selectedInvoiceId && overrideReason) {
            overrideMutation.mutate({ id: selectedInvoiceId, reason: overrideReason });
          }
        }}
        onCancel={() => {
          setOverrideModalOpen(false);
          setOverrideReason('');
        }}
        okText="Setujui Override"
        okButtonProps={{ disabled: overrideReason.length < 5, loading: overrideMutation.isPending }}
      >
        <Text>Sebagai Head of AP, sertakan alasan tertulis resmi untuk menyetujui selisih invoice:</Text>
        <Input.TextArea
          rows={4}
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          placeholder="Contoh: Disetujui selisih biaya asuransi pengiriman sesuai klausul kontrak nomor..."
          style={{ marginTop: 12 }}
        />
      </Modal>

      {/* Side-by-Side 2-Way Matcher Drawer */}
      <Drawer
        title={
          <Space>
            <EyeOutlined style={{ color: '#0052CC' }} />
            <span>Evaluasi Side-by-Side 2-Way Matcher (R37, R38, R39)</span>
          </Space>
        }
        width={960}
        open={!!matcherInvoice}
        onClose={() => setMatcherInvoice(null)}
        destroyOnClose
      >
        {matcherInvoice && (
          <TwoWayMatcherScreen
            poData={{
              poNumber: matcherInvoice.poNumber || matcherInvoice.poId || 'PO-202608-0001',
              vendorName: 'PT Fiber Optik Nusantara',
              totalAmount: Number(matcherInvoice.totalPayableAmount) || 10000000,
            }}
            invoiceData={{
              invoiceNumber: matcherInvoice.vendorInvoiceNumber || 'INV-202608-0089',
              invoiceDate: matcherInvoice.invoiceDate,
              subtotalAmount: Number(matcherInvoice.subtotalAmount || matcherInvoice.totalPayableAmount) || 10000000,
              variance: 0,
              variancePct: 0,
            }}
          />
        )}
      </Drawer>
    </div>
  );
};

export default InvoiceListPage;

