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
  Tag,
  Grid,
  App,
  theme,
  Switch,
  Space,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SendOutlined, InfoCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { formatRupiah } from '../../../utils/currency';
import { calculatePrGrandTotal } from '../utils/calculator';
import { useAuthStore } from '../../../stores/useAuthStore';
import { prApi, type CreatePrPayload } from '../../../api/endpoints/pr';
import { branchesApi, divisionsApi, type BranchItem, type DivisionItem } from '../../../api/endpoints/organization';
import { PageHeader } from '../../../components/common/PageHeader';

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
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.sm;
  const [form] = Form.useForm();
  const { user } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [uomOptions, setUomOptions] = useState<{ value: string; label: string }[]>(DEFAULT_UOM_OPTIONS);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [divisions, setDivisions] = useState<DivisionItem[]>([]);
  const watchedItems = Form.useWatch('items', form) || [];
  const isEmergency = Form.useWatch('isEmergency', form);

  useEffect(() => {
    prApi
      .getUoms({ isActive: true })
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setUomOptions(res.data.map((u) => ({ value: u.name, label: u.name })));
        }
      })
      .catch((err) => console.warn('Failed to load UOMs from backend:', err));

    branchesApi
      .list({ isActive: true })
      .then((res) => {
        if (res.data) setBranches(res.data);
      })
      .catch((err) => console.warn('Failed to load branches:', err));

    divisionsApi
      .list({ isActive: true })
      .then((res) => {
        if (res.data) setDivisions(res.data);
      })
      .catch((err) => console.warn('Failed to load divisions:', err));
  }, []);

  // Kalkulasi grand total otomatis menggunakan calculator helper (R6)
  const grandTotal = calculatePrGrandTotal(watchedItems);

  const handleSubmit = async (values: Record<string, any>) => {
    setSubmitting(true);
    try {
      const payload: CreatePrPayload = {
        costCenter: values.costCenter || (user?.divisionId ? `CC-${user.divisionId}` : 'CC-IT'),
        divisionId: values.divisionId || user?.divisionId || 'DIV-IT',
        branchId: values.branchId || user?.branchId || 'HQ_MEDAN',
        requiredDate: values.requiredDate ? dayjs(values.requiredDate).format('YYYY-MM-DD') : dayjs().add(7, 'day').format('YYYY-MM-DD'),
        paymentTermType: values.paymentTermType,
        businessJustification: values.purpose,
        isEmergency: Boolean(values.isEmergency),
        emergencyJustification: values.isEmergency ? values.emergencyJustification : undefined,
        items: (values.items || []).map((item: any, idx: number) => ({
          lineNumber: idx + 1,
          itemName: item.itemName,
          specification: item.specification,
          quantityRequested: Number(item.quantityRequested) || 1,
          uom: item.uom || 'Unit',
          estimatedUnitPrice: Number(item.estimatedUnitPrice) || 0,
        })),
      };

      // 1. Kirim Permintaan Pembelian (PR) ke endpoint backend
      const createRes = await prApi.create(payload);
      const createdPr = createRes?.data;
      const prId = createdPr?.id;
      const prNumber = createdPr?.prNumber || 'PR';

      // 2. Submit PR untuk alur persetujuan (Workflow Approval R9)
      if (prId) {
        await prApi.submit(prId);
      }

      message.success(`Permintaan Pembelian (${prNumber}) berhasil dibuat dan diajukan untuk persetujuan!`);
      navigate('/pr');
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.response?.data?.title || err?.message || 'Gagal mengirim Permintaan Pembelian (PR)';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader
        title="Buat Permintaan Pembelian (PR)"
        subtitle="Formulir pengajuan pengadaan barang dan jasa baru (R6, R7, R8, R48)"
        breadcrumbs={[
          { title: 'Beranda', href: '/dashboard' },
          { title: 'Daftar PR', href: '/pr' },
          { title: 'Buat PR' },
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/pr')}>
            Kembali
          </Button>
        }
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          costCenter: user?.divisionId ? `CC-${user.divisionId}` : 'CC-IT',
          divisionId: user?.divisionId || 'DIV-IT',
          branchId: user?.branchId || 'HQ_MEDAN',
          paymentTermType: 'PAY_AFTER_RECEIPT',
          isEmergency: false,
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

          <Row gutter={16}>
            <Col xs={24} sm={12}>
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
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="requiredDate"
                label="Tanggal Kebutuhan / Deadline"
                rules={[{ required: true, message: 'Pilih tanggal kebutuhan' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item
                name="costCenter"
                label="Pusat Biaya (Cost Center)"
                rules={[{ required: true, message: 'Wajib mengisi Cost Center' }]}
              >
                <Input placeholder="Contoh: CC-IT-01" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={8}>
              <Form.Item
                name="divisionId"
                label="Divisi Pemohon"
                rules={[{ required: true, message: 'Pilih divisi pemohon' }]}
              >
                <Select placeholder="Pilih Divisi">
                  {divisions.length > 0 ? (
                    divisions.map((d) => (
                      <Select.Option key={d.code} value={d.code}>
                        {d.name} ({d.code})
                      </Select.Option>
                    ))
                  ) : (
                    <>
                      <Select.Option value="DIV-IT">Divisi IT (DIV-IT)</Select.Option>
                      <Select.Option value="DIV-OPS">Divisi Operasional (DIV-OPS)</Select.Option>
                      <Select.Option value="DIV-FIN">Divisi Keuangan (DIV-FIN)</Select.Option>
                      <Select.Option value="DIV-LOG">Divisi Logistik (DIV-LOG)</Select.Option>
                      <Select.Option value="DIV-GEN">Divisi Umum (DIV-GEN)</Select.Option>
                    </>
                  )}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={8}>
              <Form.Item
                name="branchId"
                label="Kantor Cabang"
                rules={[{ required: true, message: 'Pilih kantor cabang' }]}
              >
                <Select placeholder="Pilih Cabang">
                  {branches.length > 0 ? (
                    branches.map((b) => (
                      <Select.Option key={b.code} value={b.code}>
                        {b.name} ({b.code})
                      </Select.Option>
                    ))
                  ) : (
                    <>
                      <Select.Option value="HQ_MEDAN">Kantor Pusat Medan (HQ_MEDAN)</Select.Option>
                      <Select.Option value="BRANCH-JKT-01">Cabang Jakarta (BRANCH-JKT-01)</Select.Option>
                      <Select.Option value="BRANCH-SBY-01">Cabang Surabaya (BRANCH-SBY-01)</Select.Option>
                      <Select.Option value="BRANCH-BDG-01">Cabang Bandung (BRANCH-BDG-01)</Select.Option>
                    </>
                  )}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="isEmergency"
            label="Pengadaan Darurat (Emergency Procurement - R48)"
            valuePropName="checked"
            style={{ marginBottom: isEmergency ? 12 : 0 }}
          >
            <Switch checkedChildren="Darurat" unCheckedChildren="Normal" />
          </Form.Item>

          {isEmergency && (
            <Form.Item
              name="emergencyJustification"
              label="Justifikasi Kondisi Darurat (Wajib jika darurat)"
              rules={[{ required: true, message: 'Wajib mengisi alasan kondisi darurat' }]}
            >
              <TextArea rows={2} placeholder="Jelaskan alasan darurat (misal: kabel fiber optik putus, butuh penggantian segera)" />
            </Form.Item>
          )}
        </Card>

        <Card title="Daftar Baris Barang / Jasa (R6 Multi-Item Form.List)">
          {/* Header Kolom Tabel (Hanya Tampil di Desktop/Tablet) */}
          {!isMobile && (
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
          )}

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
                        padding: isMobile ? '12px 14px' : '8px 12px',
                        background: index % 2 === 1 ? '#fafcff' : '#ffffff',
                        borderRadius: 6,
                        marginBottom: 12,
                        border: '1px solid #f0f0f0',
                        boxShadow: isMobile ? '0 1px 2px rgba(0,0,0,0.03)' : 'none',
                      }}
                    >
                      {isMobile && (
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 10,
                            paddingBottom: 6,
                            borderBottom: '1px solid #f0f0f0',
                          }}
                        >
                          <Tag color="blue" style={{ fontWeight: 600 }}>
                            Item #{index + 1}
                          </Tag>
                          {fields.length > 1 && (
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => remove(name)}
                            >
                              Hapus Baris
                            </Button>
                          )}
                        </div>
                      )}

                      <Row gutter={isMobile ? [8, 8] : 12} align="middle">
                        <Col xs={24} sm={8}>
                          <Form.Item
                            {...restField}
                            name={[name, 'itemName']}
                            label={isMobile ? 'Nama Barang / Jasa' : undefined}
                            rules={[{ required: true, message: 'Nama item wajib diisi' }]}
                            style={{ marginBottom: isMobile ? 8 : 0 }}
                          >
                            <Input placeholder="Contoh: Router Switch 24-Port" />
                          </Form.Item>
                        </Col>

                        <Col xs={12} sm={3}>
                          <Form.Item
                            {...restField}
                            name={[name, 'quantityRequested']}
                            label={isMobile ? 'Jumlah (Qty)' : undefined}
                            rules={[{ required: true, message: 'Qty > 0' }]}
                            style={{ marginBottom: isMobile ? 8 : 0 }}
                          >
                            <InputNumber min={1} placeholder="Qty" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={12} sm={3}>
                          <Form.Item
                            {...restField}
                            name={[name, 'uom']}
                            label={isMobile ? 'Satuan' : undefined}
                            rules={[{ required: true, message: 'Satuan wajib diisi' }]}
                            style={{ marginBottom: isMobile ? 8 : 0 }}
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

                        <Col xs={24} sm={4}>
                          <Form.Item
                            {...restField}
                            name={[name, 'estimatedUnitPrice']}
                            label={isMobile ? 'Perkiraan Harga Satuan (Rp)' : undefined}
                            rules={[{ required: true, message: 'Harga satuan wajib diisi' }]}
                            style={{ marginBottom: isMobile ? 8 : 0 }}
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

                        <Col xs={24} sm={5} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                          {isMobile ? (
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                background: '#fafafa',
                                padding: '6px 10px',
                                borderRadius: 4,
                                marginTop: 4,
                              }}
                            >
                              <Text type="secondary" style={{ fontSize: 12 }}>Subtotal Item:</Text>
                              <Text strong style={{ fontSize: 14, color: subtotal > 0 ? token.colorPrimary : '#bfbfbf' }}>
                                {formatRupiah(subtotal)}
                              </Text>
                            </div>
                          ) : (
                            <Text strong style={{ fontSize: 14, color: subtotal > 0 ? '#1f1f1f' : '#bfbfbf' }}>
                              {formatRupiah(subtotal)}
                            </Text>
                          )}
                        </Col>

                        {!isMobile && (
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
                        )}
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

        <Space size={12} style={{ marginTop: 24 }}>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            icon={<SendOutlined />}
            loading={submitting}
          >
            Kirim Permintaan Pembelian (Submit PR)
          </Button>
          <Button
            size="large"
            onClick={() => navigate('/pr')}
            disabled={submitting}
          >
            Batal
          </Button>
        </Space>
      </Form>
    </div>
  );
};

export default PrCreateForm;
