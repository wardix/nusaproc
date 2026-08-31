import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  AutoComplete,
  DatePicker,
  Button,
  Card,
  Row,
  Col,
  Typography,
  Tooltip,
  App,
  theme,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SendOutlined, InfoCircleOutlined } from '@ant-design/icons';
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
  const { message } = App.useApp();
  const { token } = theme.useToken();
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
        {/* Header Kolom Tabel */}
        <div
          style={{
            background: '#fafafa',
            padding: '10px 12px',
            borderRadius: 6,
            marginBottom: 12,
            border: '1px solid #f0f0f0',
            fontWeight: 600,
            color: '#595959',
            fontSize: 13,
          }}
        >
          <Row gutter={12} align="middle">
            <Col xs={24} sm={8}>
              Nama Barang / Jasa <Text type="danger">*</Text>
            </Col>
            <Col xs={12} sm={3}>
              Qty <Text type="danger">*</Text>
            </Col>
            <Col xs={12} sm={3}>
              Satuan <Text type="danger">*</Text>
            </Col>
            <Col xs={12} sm={4}>
              <Tooltip title="Masukkan perkiraan harga per 1 unit/satuan barang sebelum pajak">
                Harga Satuan (Rp) <InfoCircleOutlined style={{ fontSize: 12, color: '#1890ff' }} /> <Text type="danger">*</Text>
              </Tooltip>
            </Col>
            <Col xs={12} sm={5} style={{ textAlign: 'right' }}>
              Subtotal Baris (Rp)
            </Col>
            <Col xs={24} sm={1} style={{ textAlign: 'center' }} />
          </Row>
        </div>

        <Form.List name="items">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }, index) => {
                const currentItem = watchedItems[index] || {};
                const qty = Number(currentItem.quantityRequested) || 0;
                const unitPrice = Number(currentItem.estimatedUnitPrice) || 0;
                const subtotal = qty * unitPrice;

                return (
                  <div
                    key={key}
                    style={{
                      padding: '8px 12px',
                      background: index % 2 === 1 ? '#fafcff' : '#ffffff',
                      borderRadius: 6,
                      marginBottom: 8,
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    <Row gutter={12} align="middle">
                      <Col xs={24} sm={8}>
                        <Form.Item
                          {...restField}
                          name={[name, 'itemName']}
                          rules={[{ required: true, message: 'Nama item wajib diisi' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="Contoh: Router Switch 24-Port" />
                        </Form.Item>
                      </Col>

                      <Col xs={12} sm={3}>
                        <Form.Item
                          {...restField}
                          name={[name, 'quantityRequested']}
                          rules={[{ required: true, message: 'Qty > 0' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber min={1} placeholder="Qty" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>

                      <Col xs={12} sm={3}>
                        <Form.Item
                          {...restField}
                          name={[name, 'uom']}
                          rules={[{ required: true, message: 'Satuan wajib diisi' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <AutoComplete
                            options={uomOptions}
                            filterOption={(inputValue, option) =>
                              (option?.value ?? '').toUpperCase().includes(inputValue.toUpperCase())
                            }
                            placeholder="Pilih/Ketik"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={12} sm={4}>
                        <Form.Item
                          {...restField}
                          name={[name, 'estimatedUnitPrice']}
                          rules={[{ required: true, message: 'Harga satuan wajib diisi' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber<number>
                            min={0}
                            formatter={(val) => `Rp ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                            parser={(val) => (val ? Number(val.replace(/Rp\s?|(\.*)/g, '')) : 0)}
                            placeholder="Harga Satuan"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={12} sm={5} style={{ textAlign: 'right' }}>
                        <Text strong style={{ fontSize: 14, color: subtotal > 0 ? '#1f1f1f' : '#bfbfbf' }}>
                          {formatRupiah(subtotal)}
                        </Text>
                      </Col>

                      <Col xs={24} sm={1} style={{ textAlign: 'center' }}>
                        {fields.length > 1 && (
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                          />
                        )}
                      </Col>
                    </Row>
                  </div>
                );
              })}

              <Button
                type="dashed"
                onClick={() => add({ itemName: '', quantityRequested: 1, uom: 'Unit', estimatedUnitPrice: 0 })}
                block
                icon={<PlusOutlined />}
                style={{ marginTop: 8 }}
              >
                Tambah Baris Barang / Jasa
              </Button>
            </>
          )}
        </Form.List>

        <div
          style={{
            textAlign: 'right',
            marginTop: 20,
            padding: '14px 16px',
            borderTop: '1px solid #f0f0f0',
            background: '#fafafa',
            borderRadius: 6,
          }}
        >
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
            Total Estimasi Anggaran Pengadaan:
          </Text>
          <Text strong style={{ fontSize: 20, color: token.colorPrimary }}>
            {formatRupiah(grandTotal)}
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
