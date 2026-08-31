import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Select, AutoComplete, DatePicker, Button, Card, Space, Typography, message } from 'antd';
import { PlusOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import { formatRupiah } from '../../../utils/currency';
import { calculatePrGrandTotal } from '../utils/calculator';
import { useAuthStore } from '../../../stores/useAuthStore';
import { prApi } from '../../../api/endpoints/pr';

const { Text } = Typography;
const { TextArea } = Input;

const DEFAULT_UOM_OPTIONS = [
  { value: 'Box', label: 'Box' },
  { value: 'Bulan', label: 'Bulan' },
  { value: 'Kg', label: 'Kg' },
  { value: 'Lisensi', label: 'Lisensi' },
  { value: 'Lot', label: 'Lot' },
  { value: 'Meter', label: 'Meter' },
  { value: 'Pack', label: 'Pack' },
  { value: 'Pcs', label: 'Pcs' },
  { value: 'Rim', label: 'Rim' },
  { value: 'Roll', label: 'Roll' },
  { value: 'Set', label: 'Set' },
  { value: 'Tahun', label: 'Tahun' },
  { value: 'Unit', label: 'Unit' },
];

export const PrCreateForm: React.FC = () => {
  const [form] = Form.useForm();
  const { user } = useAuthStore();
  const [uomOptions, setUomOptions] = useState<{ value: string; label: string }[]>(DEFAULT_UOM_OPTIONS);
  const watchedItems = Form.useWatch('items', form) || [];

  useEffect(() => {
    prApi
      .getUoms({ isActive: true })
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setUomOptions(res.data.map((u) => ({ value: u.name, label: u.name })));
        }
      })
      .catch((err) => console.warn('Failed to load UOMs from backend:', err));
  }, []);

  // Kalkulasi grand total otomatis menggunakan calculator helper (R6)
  const grandTotal = calculatePrGrandTotal(watchedItems);

  const handleSubmit = (values: Record<string, unknown>) => {
    message.success('Permintaan Pembelian (PR) berhasil dikirim untuk persetujuan!');
    console.log('Submitted PR:', { ...values, grandTotal, requesterId: user?.id });
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        paymentTermType: 'PAY_AFTER_RECEIPT',
        items: [{ itemName: '', quantityRequested: 1, uom: 'Unit', estimatedUnitPrice: 0 }],
      }}
      onFinish={handleSubmit}
    >
      <Card title="Informasi Permintaan Pembelian (PR)" style={{ marginBottom: 24 }}>
        <Form.Item
          name="purpose"
          label="Tujuan / Justifikasi Kebutuhan Pengadaan (R6)"
          rules={[{ required: true, message: 'Wajib mengisi tujuan pengadaan' }]}
        >
          <TextArea rows={3} placeholder="Contoh: Pengadaan router switch untuk upgrade POP Medan" />
        </Form.Item>

        <Form.Item
          name="paymentTermType"
          label="Metode Pembayaran yang Diajukan (R7)"
          rules={[{ required: true, message: 'Wajib memilih cara pembayaran!' }]}
        >
          <Select placeholder="Pilih cara pembayaran">
            <Select.Option value="ADVANCE_OR_COD">Bayar Dimuka / COD (Jalur Uang Muka)</Select.Option>
            <Select.Option value="PAY_AFTER_RECEIPT">Bayar Setelah Terima Barang (Jalur Standar BAST)</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="requiredDate"
          label="Tanggal Kebutuhan / Deadline"
          rules={[{ required: true, message: 'Pilih tanggal kebutuhan' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Card>

      <Card title="Daftar Baris Barang / Jasa (R6 Multi-Item Form.List)">
        <Form.List name="items">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Space key={key} style={{ display: 'flex', marginBottom: 12 }} align="baseline" wrap>
                  <Form.Item
                    {...restField}
                    name={[name, 'itemName']}
                    rules={[{ required: true, message: 'Nama item wajib diisi' }]}
                  >
                    <Input placeholder="Nama Barang / Jasa" style={{ width: 260 }} />
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
                    rules={[{ required: true, message: 'Satuan wajib diisi' }]}
                  >
                    <AutoComplete
                      options={uomOptions}
                      filterOption={(inputValue, option) =>
                        (option?.value ?? '').toUpperCase().includes(inputValue.toUpperCase())
                      }
                      placeholder="Satuan (Pilih/Ketik)"
                      style={{ width: 140 }}
                    />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    name={[name, 'estimatedUnitPrice']}
                    rules={[{ required: true, message: 'Harga satuan wajib diisi' }]}
                  >
                    <InputNumber<number>
                      min={0}
                      formatter={(val) => `Rp ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                      parser={(val) => (val ? Number(val.replace(/Rp\s?|(\.*)/g, '')) : 0)}
                      placeholder="Estimasi Harga"
                      style={{ width: 180 }}
                    />
                  </Form.Item>

                  {fields.length > 1 && (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove(name)}
                    />
                  )}
                </Space>
              ))}

              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                Tambah Baris Item
              </Button>
            </>
          )}
        </Form.List>

        <div style={{ textAlign: 'right', marginTop: 24, padding: '12px 0', borderTop: '1px solid #f0f0f0' }}>
          <Text strong style={{ fontSize: 18, color: '#0052CC' }}>
            Total Estimasi Anggaran: {formatRupiah(grandTotal)}
          </Text>
        </div>
      </Card>

      <Button
        type="primary"
        htmlType="submit"
        size="large"
        icon={<SendOutlined />}
        style={{ marginTop: 24 }}
      >
        Kirim Permintaan Pembelian (Submit PR)
      </Button>
    </Form>
  );
};

export default PrCreateForm;
