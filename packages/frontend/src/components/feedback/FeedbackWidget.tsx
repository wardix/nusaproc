import React, { useState } from 'react';
import {
  Button,
  Modal,
  Form,
  Input,
  Radio,
  Select,
  Checkbox,
  Image,
  Space,
  Tag,
  Typography,
  message,
  Tooltip,
} from 'antd';
import {
  CustomerServiceOutlined,
  BugOutlined,
  BulbOutlined,
  CommentOutlined,
  CameraOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { toPng } from 'html-to-image';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  feedbackApi,
  type FeedbackCategory,
  type FeedbackUrgency,
} from '../../api/endpoints/feedback';

const { Text } = Typography;
const { TextArea } = Input;

export const FeedbackWidget: React.FC = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  const [form] = Form.useForm();

  const [isOpen, setIsOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory>('BUG');

  const handleOpenModal = async () => {
    setIsCapturing(true);
    let capturedUri: string | null = null;

    try {
      // Hide any widget elements before capture
      const widgetEl = document.getElementById('np-feedback-trigger-btn');
      if (widgetEl) widgetEl.style.display = 'none';

      capturedUri = await toPng(document.body, {
        cacheBust: true,
        pixelRatio: 1,
        quality: 0.85,
        filter: (node) => {
          // Exclude modal portals and trigger button
          if (node instanceof HTMLElement && node.id === 'np-feedback-trigger-btn') {
            return false;
          }
          return true;
        },
      });

      if (widgetEl) widgetEl.style.display = 'flex';
    } catch (err) {
      console.warn('Screenshot capture failed, proceeding without screenshot:', err);
    } finally {
      setIsCapturing(false);
    }

    setScreenshotData(capturedUri);
    setIncludeScreenshot(!!capturedUri);
    form.resetFields();
    form.setFieldsValue({
      category: 'BUG',
      urgency: 'MEDIUM',
      title: '',
      description: '',
    });
    setSelectedCategory('BUG');
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setScreenshotData(null);
  };

  const handleSubmit = async (values: {
    category: FeedbackCategory;
    urgency?: FeedbackUrgency;
    title?: string;
    description: string;
  }) => {
    setIsSubmitting(true);
    try {
      const systemInfo = {
        userAgent: navigator.userAgent,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        platform: navigator.platform,
        language: navigator.language,
      };

      await feedbackApi.submit({
        category: values.category,
        urgency: values.urgency || 'MEDIUM',
        title: values.title || undefined,
        description: values.description,
        pageUrl: location.pathname + location.search,
        activeRole: user?.activeRole || 'REQUESTER',
        screenshotData: includeScreenshot ? screenshotData : null,
        systemInfo,
      });

      message.success('Terima kasih! Masukan Anda telah berhasil dikirim ke tim pengembang.');
      handleClose();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Gagal mengirim masukan';
      message.error(`Pengiriman gagal: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div
        id="np-feedback-trigger-btn"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 999,
          display: 'flex',
        }}
      >
        <Tooltip title="Laporkan Kendala atau Beri Masukan" placement="left">
          <Button
            type="primary"
            shape="round"
            size="large"
            icon={<CustomerServiceOutlined />}
            loading={isCapturing}
            onClick={handleOpenModal}
            style={{
              boxShadow: '0 4px 14px rgba(0, 82, 204, 0.4)',
              background: '#0052CC',
              borderColor: '#0052CC',
              fontWeight: 500,
            }}
          >
            Feedback
          </Button>
        </Tooltip>
      </div>

      {/* Feedback Dialog Modal */}
      <Modal
        title={
          <Space>
            <CommentOutlined style={{ color: '#0052CC' }} />
            <span>Kirim Masukan & Laporan Kendala</span>
          </Space>
        }
        open={isOpen}
        onCancel={handleClose}
        footer={null}
        width={650}
        destroyOnClose
      >
        <div style={{ marginBottom: 16, background: '#f5f7fa', padding: '10px 14px', borderRadius: 6 }}>
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Konteks Halaman Saat Ini:
            </Text>
            <Space wrap>
              <Tag color="blue">URL: {location.pathname}</Tag>
              <Tag color="purple">Peran: {user?.activeRole || 'REQUESTER'}</Tag>
              <Tag>{user?.fullName || user?.email || 'Pengguna'}</Tag>
            </Space>
          </Space>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            category: 'BUG',
            urgency: 'MEDIUM',
          }}
        >
          <Form.Item name="category" label="Jenis Masukan" rules={[{ required: true }]}>
            <Radio.Group
              buttonStyle="solid"
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ width: '100%' }}
            >
              <Radio.Button value="BUG" style={{ width: '33.3%', textAlign: 'center' }}>
                <BugOutlined style={{ marginRight: 4, color: '#ff4d4f' }} /> Bug / Kendala
              </Radio.Button>
              <Radio.Button value="FEATURE_REQUEST" style={{ width: '33.3%', textAlign: 'center' }}>
                <BulbOutlined style={{ marginRight: 4, color: '#faad14' }} /> Usulan Fitur
              </Radio.Button>
              <Radio.Button value="FEEDBACK" style={{ width: '33.3%', textAlign: 'center' }}>
                <CommentOutlined style={{ marginRight: 4, color: '#52c41a' }} /> Saran Umum
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          {selectedCategory === 'BUG' && (
            <Form.Item name="urgency" label="Tingkat Keparahan / Urgensi" rules={[{ required: true }]}>
              <Select placeholder="Pilih tingkat keparahan">
                <Select.Option value="LOW">Rendah (Tampilan / Tidak Menghambat Kerja)</Select.Option>
                <Select.Option value="MEDIUM">Sedang (Ada Fitur Tidak Bekerja Normal)</Select.Option>
                <Select.Option value="HIGH">Tinggi (Alur Kerja Terganggu)</Select.Option>
                <Select.Option value="CRITICAL">Kritis (Sistem Error / Blocker)</Select.Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item name="title" label="Judul Singkat (Opsional)">
            <Input placeholder="Contoh: Tombol simpan tidak merespons setelah diklik" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Deskripsi Lengkap"
            rules={[{ required: true, message: 'Harap jelaskan kendala atau masukan Anda' }]}
          >
            <TextArea
              rows={4}
              placeholder="Jelaskan apa yang terjadi, apa yang Anda harapkan, atau langkah-langkah untuk mereproduksi kendala tersebut..."
            />
          </Form.Item>

          {screenshotData && (
            <div style={{ marginBottom: 20, border: '1px solid #e8e8e8', borderRadius: 6, padding: 12 }}>
              <Checkbox
                checked={includeScreenshot}
                onChange={(e) => setIncludeScreenshot(e.target.checked)}
                style={{ marginBottom: 10, fontWeight: 500 }}
              >
                <CameraOutlined style={{ marginRight: 4 }} /> Sertakan Tangkapan Layar Halaman Ini
              </Checkbox>

              {includeScreenshot && (
                <div style={{ textAlign: 'center', background: '#fafafa', padding: 8, borderRadius: 4 }}>
                  <Image
                    src={screenshotData}
                    alt="Preview Tangkapan Layar"
                    style={{ maxHeight: 180, objectFit: 'contain', borderRadius: 4 }}
                  />
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Klik gambar untuk memperbesar
                    </Text>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button onClick={handleClose}>Batal</Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              loading={isSubmitting}
              style={{ background: '#0052CC', borderColor: '#0052CC' }}
            >
              Kirim Masukan
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  );
};

export default FeedbackWidget;
