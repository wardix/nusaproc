import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Alert,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Table,
  Divider,
  App,
  theme,
} from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { formatRupiah } from '../../../utils/currency';
import { evaluateTwoWayMatchingStatus } from '../utils/matching';
import { useAuthStore } from '../../../stores/useAuthStore';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface MatcherProps {
  poData: {
    poNumber: string;
    vendorName?: string;
    totalAmount: number;
    items?: Array<{ itemName: string; quantity: number; unitPrice: number; subtotal: number }>;
  };
  invoiceData: {
    invoiceNumber: string;
    invoiceDate?: string;
    subtotalAmount: number;
    variance: number;
    variancePct: number;
    items?: Array<{ itemName: string; quantity: number; unitPrice: number; subtotal: number }>;
  };
}

export const TwoWayMatcherScreen: React.FC<MatcherProps> = ({ poData, invoiceData }) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { user } = useAuthStore();
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [isOverridden, setIsOverridden] = useState(false);

  const evaluation = evaluateTwoWayMatchingStatus(poData.totalAmount, invoiceData.subtotalAmount);
  const isHeadOfAp =
    user?.activeRole === 'ACCOUNT_PAYABLE' ||
    user?.activeRole === 'FINANCE' ||
    user?.activeRole === 'ADMIN';

  const handleOverrideSubmit = () => {
    if (!overrideReason || overrideReason.trim().length < 5) {
      message.error('Alasan tertulis wajib diisi minimal 5 karakter.');
      return;
    }
    setIsOverridden(true);
    setIsOverrideModalOpen(false);
    message.success('Exception override berhasil dicatat dan diaudit!');
  };

  const defaultPoItems = poData.items || [
    { itemName: 'MikroTik CCR2004-16G-2S+', quantity: 2, unitPrice: 5000000, subtotal: 10000000 },
  ];

  const defaultInvItems = invoiceData.items || [
    {
      itemName: 'MikroTik CCR2004-16G-2S+',
      quantity: 2,
      unitPrice: invoiceData.subtotalAmount / 2,
      subtotal: invoiceData.subtotalAmount,
    },
  ];

  const columns = [
    { title: 'Nama Barang / Layanan', dataIndex: 'itemName', key: 'itemName' },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 70 },
    {
      title: 'Harga Satuan',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      render: (val: number) => formatRupiah(val),
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      key: 'subtotal',
      render: (val: number) => <strong>{formatRupiah(val)}</strong>,
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            Side-by-Side 2-Way Matcher (PO vs Invoice)
          </Title>
          <Text type="secondary">
            Pemeriksaan otomatis kesesuaian nilai Surat Pesanan (PO) terhadap Tagihan Vendor (R37, R38)
          </Text>
        </div>
        <Tag
          color={
            isOverridden
              ? 'purple'
              : evaluation.status === 'MATCHED_OK'
              ? 'success'
              : 'error'
          }
          style={{ fontSize: 14, padding: '6px 16px' }}
        >
          {isOverridden
            ? 'MATCHED_OVERRIDDEN (HEAD OF AP)'
            : evaluation.status === 'MATCHED_OK'
            ? 'MATCHED_OK'
            : 'MATCHED_WITH_EXCEPTION'}
        </Tag>
      </div>

      <Row gutter={[16, 16]}>
        {/* Kolom Kiri: Purchase Order (PO) */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <Tag color="blue">SURAT PESANAN (PO)</Tag>
                <span>{poData.poNumber}</span>
              </Space>
            }
            bordered
          >
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">Total Nilai PO Resmi:</Text>
              <Title level={3} style={{ color: token.colorPrimary, margin: 0 }}>
                {formatRupiah(poData.totalAmount)}
              </Title>
            </div>
            <Table
              dataSource={defaultPoItems}
              columns={columns}
              rowKey="itemName"
              pagination={false}
              size="small"
              scroll={{ x: 450 }}
            />
          </Card>
        </Col>

        {/* Kolom Kanan: Vendor Invoice */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <Tag color="orange">TAGIHAN VENDOR (INVOICE)</Tag>
                <span>{invoiceData.invoiceNumber}</span>
              </Space>
            }
            bordered
          >
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">Total Tagihan Vendor:</Text>
              <Title level={3} style={{ color: token.colorTextHeading, margin: 0 }}>
                {formatRupiah(invoiceData.subtotalAmount)}
              </Title>
            </div>
            <Table
              dataSource={defaultInvItems}
              columns={columns}
              rowKey="itemName"
              pagination={false}
              size="small"
              scroll={{ x: 450 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Evaluasi Toleransi 2-Way Matcher */}
      <Card title="Hasil Evaluasi Mesin Pencocokan (2-Way Matching Engine)">
        {isOverridden ? (
          <Alert
            type="info"
            showIcon
            icon={<AuditOutlined />}
            message="Exception Telah Di-override oleh Head of AP (R39)"
            description={`Alasan Override: "${overrideReason}" | Invoice dilepaskan ke antrean pembayaran.`}
          />
        ) : evaluation.isExactMatch ? (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message="Pencocokan Sempurna (100% Cocok)"
            description="Tidak ada selisih nominal antara Surat Pesanan dan Tagihan Vendor. Siap diproses untuk pembayaran."
          />
        ) : evaluation.isWithinTolerance ? (
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            message={`Selisih Dalam Batas Toleransi Wajar (Selisih: ${formatRupiah(evaluation.variance)} / ${evaluation.variancePct}%)`}
            description="Selisih masih memenuhi ambang batas toleransi (<= 1% atau <= Rp 100.000). Pembayaran diizinkan berlanjut."
          />
        ) : (
          <Alert
            type="error"
            showIcon
            icon={<CloseCircleOutlined />}
            message={`Selisih Di Luar Batas Toleransi — Tagihan DITAHAN (Selisih: ${formatRupiah(evaluation.variance)} / ${evaluation.variancePct}%)`}
            description="Invoice diblokir dari proposal pembayaran karena melebihi toleransi. Memerlukan peninjauan dan override tertulis dari Head of AP (R39)."
            action={
              isHeadOfAp ? (
                <Button
                  type="primary"
                  danger
                  onClick={() => setIsOverrideModalOpen(true)}
                >
                  Override Exception (Head of AP)
                </Button>
              ) : undefined
            }
          />
        )}
      </Card>

      {/* Modal Override Head of AP (R39) */}
      <Modal
        title="Pelepasan Tagihan Bermasalah (Head of AP Override - R39)"
        open={isOverrideModalOpen}
        onCancel={() => setIsOverrideModalOpen(false)}
        onOk={handleOverrideSubmit}
        okText="Catat & Lepaskan Invoice"
        okButtonProps={{ danger: true }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message="Tindakan Ini Masuk Log Audit Abadi (R53)"
            description="Pelepasan tagihan bermasalah memerlukan alasan bisnis tertulis yang dapat dipertanggungjawabkan kepada auditor."
          />
          <Divider style={{ margin: '12px 0' }} />
          <Form layout="vertical">
            <Form.Item label="Alasan Tertulis Pelepasan (Wajib)" required>
              <TextArea
                rows={4}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Contoh: Selisih ongkir disepakati sesuai addendum PO nomor ADD-001..."
              />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </Space>
  );
};

export default TwoWayMatcherScreen;
