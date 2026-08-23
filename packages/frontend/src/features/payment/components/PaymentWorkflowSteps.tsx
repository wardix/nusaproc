import React from 'react';
import { Steps, Card, Typography, Tag, Space } from 'antd';
import {
  FileTextOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  DollarCircleOutlined,
} from '@ant-design/icons';
import { getPaymentWorkflowCurrentStep } from '../utils/workflow';

const { Text } = Typography;

interface PaymentWorkflowStepsProps {
  status: 'DRAFT' | 'PENDING_CHECK' | 'APPROVED_FOR_PAYMENT' | 'IN_PROGRESS' | 'PAID' | 'REJECTED';
  makerName?: string;
  checkerName?: string;
  executorName?: string;
}

export const PaymentWorkflowSteps: React.FC<PaymentWorkflowStepsProps> = ({
  status,
  makerName,
  checkerName,
  executorName,
}) => {
  const currentStep = getPaymentWorkflowCurrentStep(status);
  const isRejected = status === 'REJECTED';

  const stepItems = [
    {
      title: '1. Pembuat (Maker)',
      subTitle: <Tag color="blue">Finance Staff</Tag>,
      description: (
        <Space direction="vertical" size={2}>
          <Text type="secondary">Inisiasi proposal pembayaran tagihan</Text>
          {makerName && <Text strong>{makerName}</Text>}
        </Space>
      ),
      icon: <FileTextOutlined />,
    },
    {
      title: '2. Pemeriksa (Checker)',
      subTitle: <Tag color="purple">Head of AP</Tag>,
      description: (
        <Space direction="vertical" size={2}>
          <Text type="secondary">Verifikasi kesesuaian & persetujuan rilis</Text>
          {checkerName && <Text strong>{checkerName}</Text>}
          {isRejected && <Tag color="error">Ditolak oleh Checker</Tag>}
        </Space>
      ),
      icon: <AuditOutlined />,
      status: isRejected ? ('error' as const) : undefined,
    },
    {
      title: '3. Pelaksana (Executor)',
      subTitle: <Tag color="green">Finance Treasury</Tag>,
      description: (
        <Space direction="vertical" size={2}>
          <Text type="secondary">Eksekusi transfer dana ke rekening vendor</Text>
          {executorName && <Text strong>{executorName}</Text>}
        </Space>
      ),
      icon: <DollarCircleOutlined />,
    },
    {
      title: '4. Selesai (Disbursed)',
      description: <Text type="secondary">Pembayaran lunas & mutasi tercatat</Text>,
      icon: <CheckCircleOutlined />,
    },
  ];

  return (
    <Card title="Alur Persetujuan Pembayaran 3-Tahap (Maker-Checker-Executor - R42)">
      <Steps current={currentStep} items={stepItems} />
    </Card>
  );
};

export default PaymentWorkflowSteps;
