import React from 'react';
import {
  Form,
  Input,
  DatePicker,
  Button,
  Card,
  Upload,
  Typography,
  Table,
  InputNumber,
  Radio,
  App,
  theme,
} from 'antd';
import {
  InboxOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

export const BastCreateForm: React.FC = () => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const [form] = Form.useForm();

  const mockPoItems = [
    { key: '1', itemName: 'MikroTik CCR2004-16G-2S+', orderedQty: 2, uom: 'Unit' },
    { key: '2', itemName: 'SFP+ 10G Optical Transceiver', orderedQty: 4, uom: 'Pcs' },
  ];

  const columns = [
    { title: 'Nama Barang', dataIndex: 'itemName', key: 'itemName' },
    { title: 'Qty Dipesan', dataIndex: 'orderedQty', key: 'orderedQty' },
    { title: 'Satuan', dataIndex: 'uom', key: 'uom' },
    {
      title: 'Qty Diterima Fisik (R29)',
      key: 'receivedQty',
      render: (_: unknown, record: { key: string; orderedQty: number }) => (
        <Form.Item
          name={['items', record.key, 'receivedQty']}
          initialValue={record.orderedQty}
          rules={[{ required: true, message: 'Qty diterima wajib diisi' }]}
          style={{ margin: 0 }}
        >
          <InputNumber min={0} max={record.orderedQty} />
        </Form.Item>
      ),
    },
    {
      title: 'Kondisi Fisik',
      key: 'condition',
      render: (_: unknown, record: { key: string }) => (
        <Form.Item
          name={['items', record.key, 'condition']}
          initialValue="GOOD"
          style={{ margin: 0 }}
        >
          <Radio.Group size="small">
            <Radio.Button value="GOOD">Bagus / Sesuai</Radio.Button>
            <Radio.Button value="DEFECT">Cacat / Rusak</Radio.Button>
          </Radio.Group>
        </Form.Item>
      ),
    },
  ];

  const handleSubmit = (values: Record<string, unknown>) => {
    message.success('Berita Acara Serah Terima (BAST) & Lampiran Tagihan berhasil disimpan!');
    console.log('Submitted BAST:', values);
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Card title="Pencatatan Penerimaan Barang / Jasa (BAST - R29)" style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginTop: 0 }}>
          Informasi BAST
        </Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Pencatatan penerimaan fisik barang dari vendor oleh tim gudang/penerima independen (R31 SoD).
        </Text>

        <Form.Item
          name="poNumber"
          label="Nomor Surat Pesanan (PO)"
          rules={[{ required: true, message: 'Nomor PO wajib diisi' }]}
          initialValue="PO-202608-0001"
        >
          <Input placeholder="Contoh: PO-202608-0001" />
        </Form.Item>

        <Form.Item
          name="bastNumber"
          label="Nomor Dokumen BAST Gudang"
          rules={[{ required: true, message: 'Nomor BAST wajib diisi' }]}
          initialValue={`BAST-${Date.now().toString().slice(-6)}`}
        >
          <Input placeholder="Contoh: BAST-202608-0089" />
        </Form.Item>

        <Form.Item
          name="receivedDate"
          label="Tanggal Penerimaan Fisik"
          rules={[{ required: true, message: 'Tanggal penerimaan wajib dipilih' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="notes" label="Catatan Kondisi Penerimaan">
          <TextArea rows={3} placeholder="Barang diterima lengkap dalam kardus bersegel..." />
        </Form.Item>
      </Card>

      <Card title="Daftar Item Diterima Fisik" style={{ marginBottom: 24 }}>
        <Table dataSource={mockPoItems} columns={columns} pagination={false} size="middle" scroll={{ x: 600 }} />
      </Card>

      {/* Simultaneous Invoice & Tax Invoice Upload Component (R29) */}
      <Card title="Unggah Serentak Tagihan Vendor & Faktur Pajak (R29 Simultaneous Upload)">
        <Dragger
          name="files"
          multiple
          action="/api/v1/storage/upload"
          accept=".pdf,.png,.jpg,.jpeg"
          beforeUpload={(file) => {
            const isValidType =
              file.type === 'application/pdf' ||
              file.type === 'image/png' ||
              file.type === 'image/jpeg';
            if (!isValidType) {
              message.error('Format file harus PDF, PNG, atau JPEG!');
            }
            return isValidType || Upload.LIST_IGNORE;
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: token.colorPrimary, fontSize: 48 }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 600 }}>
            Tarik & Lepas File Invoice Vendor & Faktur Pajak (e-Faktur) ke sini
          </p>
          <p className="ant-upload-hint">
            Mendukung file PDF asli, PNG, atau JPEG. File akan otomatis divalidasi magic bytes dan dipindai antivirus secara instan (R51).
          </p>
        </Dragger>
      </Card>

      <Button
        type="primary"
        htmlType="submit"
        size="large"
        icon={<CheckCircleOutlined />}
        style={{ marginTop: 24 }}
      >
        Simpan & Terbitkan BAST
      </Button>
    </Form>
  );
};

export default BastCreateForm;
