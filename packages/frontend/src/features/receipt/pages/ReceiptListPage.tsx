import React from 'react';
import { Table, Button, Tag, Card, Typography } from 'antd';
import { PlusOutlined, FileDoneOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { receiptApi } from '../../../api/endpoints/receipt';

const { Title, Text } = Typography;

export const ReceiptListPage: React.FC = () => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['receipts'],
    queryFn: () => receiptApi.list(),
  });

  const receipts = data?.data || [];

  const columns = [
    {
      title: 'Nomor BAST / GR',
      dataIndex: 'grNumber',
      key: 'grNumber',
      render: (text: string) => (
        <SpaceText text={text} />
      ),
    },
    {
      title: 'Nomor Surat Jalan',
      dataIndex: 'deliveryNoteNumber',
      key: 'deliveryNoteNumber',
      render: (sj: string) => <Tag color="blue">{sj || '-'}</Tag>,
    },
    {
      title: 'Tipe Penerimaan',
      dataIndex: 'receiptType',
      key: 'receiptType',
      render: (type: string) => <Tag color="geekblue">{type}</Tag>,
    },
    {
      title: 'Tanggal Penerimaan',
      dataIndex: 'receivedDate',
      key: 'receivedDate',
    },
    {
      title: 'Catatan Kondisi Barang',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
  ];

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            Daftar Berita Acara Serah Terima (BAST) & Penerimaan Barang
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/receipts/create')}
            style={{ background: '#0052CC' }}
          >
            Penerimaan Barang (BAST)
          </Button>
        </div>
      }
    >
      <Table
        columns={columns}
        dataSource={receipts}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
};

const SpaceText: React.FC<{ text: string }> = ({ text }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <FileDoneOutlined style={{ color: '#0052CC' }} />
    <Text strong style={{ color: '#0052CC' }}>
      {text}
    </Text>
  </span>
);

export default ReceiptListPage;
