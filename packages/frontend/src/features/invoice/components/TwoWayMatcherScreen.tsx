import React from 'react';
import { Card, Row, Col, Typography, Alert } from 'antd';
import { formatRupiah } from '../../../utils/currency';

const { Title, Text } = Typography;

interface MatcherProps {
  poData: { poNumber: string; totalAmount: number; items?: unknown[] };
  invoiceData: { invoiceNumber: string; subtotalAmount: number; variance: number; variancePct: number };
}

export const TwoWayMatcherScreen: React.FC<MatcherProps> = ({ poData, invoiceData }) => {
  const isWithinTolerance = Math.abs(invoiceData.variance) <= 100000 || invoiceData.variancePct <= 1.0;
  const isExactMatch = invoiceData.variance === 0;

  return (
    <div>
      <Row gutter={16}>
        <Col span={12}>
          <Card title={`Surat Pesanan: ${poData.poNumber}`} bordered={false}>
            <Text type="secondary">Total Nilai PO Resmi:</Text>
            <Title level={4}>{formatRupiah(poData.totalAmount)}</Title>
          </Card>
        </Col>

        <Col span={12}>
          <Card title={`Invoice Vendor: ${invoiceData.invoiceNumber}`} bordered={false}>
            <Text type="secondary">Total Tagihan:</Text>
            <Title level={4}>{formatRupiah(invoiceData.subtotalAmount)}</Title>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} title="Hasil Kalkulasi 2-Way Matching Engine">
        {isExactMatch ? (
          <Alert message="Pencocokan Sempurna (100% Cocok)" type="success" showIcon />
        ) : isWithinTolerance ? (
          <Alert
            message={`Selisih dalam Batas Wajar (${invoiceData.variancePct}% / ${formatRupiah(invoiceData.variance)})`}
            description="Invoice diizinkan masuk ke antrean pembayaran."
            type="warning"
            showIcon
          />
        ) : (
          <Alert
            message={`Selisih di Luar Batas Wajar (${formatRupiah(invoiceData.variance)})`}
            description="Invoice DITAHAN (Held). Memerlukan persetujuan tertulis Head of AP untuk pelepasan penandaan (R39)."
            type="error"
            showIcon
          />
        )}
      </Card>
    </div>
  );
};
