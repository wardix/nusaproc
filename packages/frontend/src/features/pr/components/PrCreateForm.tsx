import React from 'react';
import { Form, Input, InputNumber, Select, DatePicker, Button, Card, Space, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { formatRupiah } from '../../../utils/currency';

const { Text } = Typography;

export const PrCreateForm: React.FC = () => {
  const [form] = Form.useForm();
  const watchedItems = Form.useWatch('items', form) || [];

  // Kalkulasi total estimasi otomatis secara reaktif
  const grandTotal = watchedItems.reduce((acc: number, item: { quantityRequested?: number; estimatedUnitPrice?: number }) => {
    const qty = Number(item?.quantityRequested) || 0;
    const price = Number(item?.estimatedUnitPrice) || 0;
    return acc + qty * price;
  }, 0);

  return (
    <Form form={form} layout="vertical" onFinish={(values) => console.log(values)}>
      <Card title="Informasi Permintaan Pembelian" style={{ marginBottom: 24 }}>
        <Form.Item
          name="paymentTermType"
          label="Metode Pembayaran yang Diajukan (R7)"
          rules={[{ required: true, message: 'Wajib memilih cara bayar!' }]}
        >
          <Select placeholder="Pilih cara pembayaran">
            <Select.Option value="ADVANCE_OR_COD">Bayar Dimuka / COD (Jalur Uang Muka)</Select.Option>
            <Select.Option value="PAY_AFTER_RECEIPT">Bayar Setelah Terima (Jalur Standar)</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="requiredDate" label="Tanggal Kebutuhan" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Card>

      <Card title="Daftar Item Barang / Jasa (R6)">
        <Form.List name="items">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                  <Form.Item
                    {...restField}
                    name={[name, 'itemName']}
                    rules={[{ required: true, message: 'Nama item wajib diisi' }]}
                  >
                    <Input placeholder="Nama Barang / Jasa" style={{ width: 220 }} />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    name={[name, 'quantityRequested']}
                    rules={[{ required: true, message: 'Qty > 0' }]}
                  >
                    <InputNumber min={1} placeholder="Qty" style={{ width: 90 }} />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    name={[name, 'uom']}
                    rules={[{ required: true, message: 'Satuan' }]}
                  >
                    <Input placeholder="Satuan (Pcs/Unit)" style={{ width: 120 }} />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    name={[name, 'estimatedUnitPrice']}
                    rules={[{ required: true, message: 'Harga' }]}
                  >
                    <InputNumber<number>
                      min={0}
                      formatter={(val) => `Rp ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                      parser={(val) => (val ? Number(val.replace(/Rp\s?|(\.*)/g, '')) : 0)}
                      placeholder="Estimasi Harga"
                      style={{ width: 180 }}
                    />
                  </Form.Item>

                  <DeleteOutlined onClick={() => remove(name)} style={{ color: '#FF4D4F' }} />
                </Space>
              ))}

              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                Tambah Baris Item
              </Button>
            </>
          )}
        </Form.List>

        <div style={{ textAlign: 'right', marginTop: 24 }}>
          <Text strong style={{ fontSize: 16 }}>
            Total Estimasi Anggaran: {formatRupiah(grandTotal)}
          </Text>
        </div>
      </Card>

      <Button type="primary" htmlType="submit" size="large" style={{ marginTop: 24 }}>
        Kirim Permintaan Pembelian
      </Button>
    </Form>
  );
};
