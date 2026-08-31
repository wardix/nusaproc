import React from 'react';
import { Table, Button, Tag, Card, Typography } from 'antd';
import { PlusOutlined, FileDoneOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { receiptApi } from '../../../api/endpoints/receipt';
import { PageHeader } from '../../../components/common/PageHeader';

const { Text } = Typography;

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Daftar Berita Acara Serah Terima (BAST) & Penerimaan Barang"
        subtitle="Kelola penerimaan barang fisik di gudang atau serah terima jasa dari vendor rekanan (R28–R32)."
        icon={<FileDoneOutlined style={{ color: '#0052CC' }} />}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/receipts/create')}
          >
            Penerimaan Barang (BAST)
          </Button>
        }
      />

      <Card>
        <Table
          columns={columns}
          dataSource={receipts}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 750 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
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
