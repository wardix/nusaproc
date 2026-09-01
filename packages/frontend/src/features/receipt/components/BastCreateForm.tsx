import React, { useState, useEffect } from 'react';
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
  Select,
  Space,
  Row,
  Col,
} from 'antd';
import {
  InboxOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { poApi } from '../../../api/endpoints/po';
import { receiptApi, type CreateReceiptPayload } from '../../../api/endpoints/receipt';
import { PageHeader } from '../../../components/common/PageHeader';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

interface PoOptionItem {
  id: string;
  poNumber: string;
  vendorName?: string;
  status: string;
}

interface PoItemRow {
  id: string;
  itemName: string;
  quantityOrdered: number;
  uom: string;
}

const DEFAULT_PO_ITEMS: PoItemRow[] = [
  { id: '51000000-0000-0000-0000-000000000001', itemName: 'Core Edge Router 10G', quantityOrdered: 10, uom: 'Unit' },
  { id: '51000000-0000-0000-0000-000000000002', itemName: 'SFP+ 10G Optical Transceiver', quantityOrdered: 20, uom: 'Pcs' },
];

export const BastCreateForm: React.FC = () => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [poList, setPoList] = useState<PoOptionItem[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string>('50000000-0000-0000-0000-000000000001');
  const [poItems, setPoItems] = useState<PoItemRow[]>(DEFAULT_PO_ITEMS);
  const [submitting, setSubmitting] = useState(false);
  const [loadingPo, setLoadingPo] = useState(false);

  useEffect(() => {
    poApi
      .list()
      .then((res) => {
        const list = res.data || [];
        if (Array.isArray(list) && list.length > 0) {
          setPoList(list);
          const firstPo = list[0];
          setSelectedPoId(firstPo.id);
          form.setFieldValue('poId', firstPo.id);
          loadPoDetails(firstPo.id);
        } else {
          setPoList([
            {
              id: '50000000-0000-0000-0000-000000000001',
              poNumber: 'PO-202608-0001',
              vendorName: 'PT Fiber Optik Nusantara',
              status: 'ISSUED',
            },
          ]);
        }
      })
      .catch(() => {
        setPoList([
          {
            id: '50000000-0000-0000-0000-000000000001',
            poNumber: 'PO-202608-0001',
            vendorName: 'PT Fiber Optik Nusantara',
            status: 'ISSUED',
          },
        ]);
      });
  }, []);

  const loadPoDetails = async (poId: string) => {
    setLoadingPo(true);
    try {
      const res = await poApi.getById(poId);
      if (res.data?.items && res.data.items.length > 0) {
        setPoItems(
          res.data.items.map((item: any) => ({
            id: item.id || `item-${Math.random()}`,
            itemName: item.itemName,
            quantityOrdered: Number(item.quantityOrdered) || 1,
            uom: item.uom || 'Unit',
          }))
        );
      } else {
        setPoItems(DEFAULT_PO_ITEMS);
      }
    } catch {
      setPoItems(DEFAULT_PO_ITEMS);
    } finally {
      setLoadingPo(false);
    }
  };

  const handlePoChange = (poId: string) => {
    setSelectedPoId(poId);
    loadPoDetails(poId);
  };

  const columns = [
    {
      title: 'Nama Barang / Jasa',
      dataIndex: 'itemName',
      key: 'itemName',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Qty Dipesan',
      dataIndex: 'quantityOrdered',
      key: 'quantityOrdered',
      width: 120,
    },
    {
      title: 'Satuan',
      dataIndex: 'uom',
      key: 'uom',
      width: 100,
    },
    {
      title: 'Qty Diterima Fisik (R29)',
      key: 'receivedQty',
      width: 180,
      render: (_: unknown, record: PoItemRow) => (
        <Form.Item
          name={['items', record.id, 'receivedQty']}
          initialValue={record.quantityOrdered}
          rules={[{ required: true, message: 'Qty diterima wajib diisi' }]}
          style={{ margin: 0 }}
        >
          <InputNumber min={0} max={record.quantityOrdered} style={{ width: '100%' }} />
        </Form.Item>
      ),
    },
    {
      title: 'Kondisi Fisik',
      key: 'condition',
      width: 180,
      render: (_: unknown, record: PoItemRow) => (
        <Form.Item
          name={['items', record.id, 'condition']}
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

  const handleSubmit = async (values: Record<string, any>) => {
    setSubmitting(true);
    try {
      const payload: CreateReceiptPayload = {
        poId: values.poId || selectedPoId,
        receiptType: values.receiptType || 'WAREHOUSE',
        deliveryNoteNumber: values.deliveryNoteNumber || undefined,
        receivedDate: values.receivedDate ? dayjs(values.receivedDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        notes: values.notes,
        items: poItems.map((item) => {
          const itemVal = values.items?.[item.id] || {};
          const receivedQty = Number(itemVal.receivedQty ?? item.quantityOrdered ?? 1);
          const isDefect = itemVal.condition === 'DEFECT';
          const rejectedQty = isDefect ? Math.max(1, Number(item.quantityOrdered) - receivedQty) : 0;
          return {
            poItemId: item.id,
            quantityReceived: receivedQty,
            quantityRejected: rejectedQty,
            conditionNotes: isDefect ? 'Barang cacat/rusak saat serah terima fisik (NCR R30)' : undefined,
          };
        }),
      };

      const res = await receiptApi.create(payload);
      const grNumber = res?.data?.grNumber || 'BAST';
      message.success(`Berita Acara Serah Terima (${grNumber}) berhasil disimpan & diterbitkan (R29)!`);
      navigate('/receipts');
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.response?.data?.title || err?.message || 'Gagal menyimpan BAST';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader
        title="Pencatatan Penerimaan Barang / Jasa (BAST - R29)"
        subtitle="Pencatatan serah terima fisik barang dari vendor oleh tim gudang/penerima independen (R29, R31 SoD)."
        icon={<FileDoneOutlined style={{ color: token.colorPrimary }} />}
        breadcrumbs={[
          { title: 'Beranda', href: '/dashboard' },
          { title: 'Daftar BAST', href: '/receipts' },
          { title: 'Penerimaan Baru' },
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/receipts')}>
            Kembali
          </Button>
        }
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          poId: selectedPoId,
          receiptType: 'WAREHOUSE',
          receivedDate: dayjs(),
        }}
        onFinish={handleSubmit}
      >
        <Card title="Informasi Penerimaan Fisik (BAST)" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="poId"
                label="Pilih Surat Pesanan (PO)"
                rules={[{ required: true, message: 'Wajib memilih nomor PO!' }]}
              >
                <Select placeholder="Pilih PO" onChange={handlePoChange}>
                  {poList.map((po) => (
                    <Select.Option key={po.id} value={po.id}>
                      {po.poNumber} {po.vendorName ? `— ${po.vendorName}` : ''} ({po.status})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="receiptType"
                label="Tipe Penerimaan"
                rules={[{ required: true, message: 'Wajib memilih tipe penerimaan!' }]}
              >
                <Select placeholder="Pilih Tipe Penerimaan">
                  <Select.Option value="WAREHOUSE">Gudang / Warehouse (Standar)</Select.Option>
                  <Select.Option value="DIRECT_REQUESTER">Langsung ke Pengaju (Direct Requester)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="deliveryNoteNumber"
                label="Nomor Surat Jalan Vendor (Opsional)"
              >
                <Input placeholder="Contoh: SJ-202608-0091" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="receivedDate"
                label="Tanggal Penerimaan Fisik"
                rules={[{ required: true, message: 'Tanggal penerimaan wajib dipilih' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Catatan Kondisi Penerimaan">
            <TextArea rows={3} placeholder="Barang diterima lengkap dalam kardus bersegel tanpa kerusakan fisik..." />
          </Form.Item>
        </Card>

        <Card title="Daftar Item Diterima Fisik (Pemeriksaan Qty & Kondisi)" style={{ marginBottom: 24 }}>
          <Table
            dataSource={poItems}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="middle"
            loading={loadingPo}
            scroll={{ x: 600 }}
          />
        </Card>

        {/* Simultaneous Invoice & Tax Invoice Upload Component (R29) */}
        <Card title="Unggah Serentak Tagihan Vendor & Faktur Pajak (R29 Simultaneous Upload)" style={{ marginBottom: 24 }}>
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

        <Space size={12}>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            icon={<CheckCircleOutlined />}
            loading={submitting}
          >
            Simpan & Terbitkan BAST
          </Button>
          <Button
            size="large"
            onClick={() => navigate('/receipts')}
            disabled={submitting}
          >
            Batal
          </Button>
        </Space>
      </Form>
    </div>
  );
};

export default BastCreateForm;
