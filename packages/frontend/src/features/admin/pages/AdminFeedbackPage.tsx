import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Select,
  Input,
  Modal,
  Form,
  Image,
  Typography,
  Descriptions,
  App,
  theme,
  type TableProps,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  CommentOutlined,
  BugOutlined,
  BulbOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { PageHeader } from '../../../components/common/PageHeader';
import { formatDate, formatDateTime, formatRelativeTime } from '../../../utils/date';
import {
  feedbackApi,
  type FeedbackItem,
  type FeedbackCategory,
  type FeedbackStatus,
  type FeedbackUrgency,
} from '../../../api/endpoints/feedback';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const CATEGORY_TAGS: Record<FeedbackCategory, { color: string; label: string; icon: React.ReactNode }> = {
  BUG: { color: 'error', label: 'Bug / Kendala', icon: <BugOutlined /> },
  FEATURE_REQUEST: { color: 'gold', label: 'Usulan Fitur', icon: <BulbOutlined /> },
  FEEDBACK: { color: 'success', label: 'Masukan Umum', icon: <CommentOutlined /> },
};

const URGENCY_TAGS: Record<FeedbackUrgency, { color: string; label: string }> = {
  LOW: { color: 'default', label: 'Rendah' },
  MEDIUM: { color: 'blue', label: 'Sedang' },
  HIGH: { color: 'orange', label: 'Tinggi' },
  CRITICAL: { color: 'red', label: 'Kritis' },
};

const STATUS_TAGS: Record<FeedbackStatus, { color: string; label: string }> = {
  OPEN: { color: 'cyan', label: 'Terbuka (Open)' },
  IN_PROGRESS: { color: 'processing', label: 'Sedang Diproses' },
  RESOLVED: { color: 'success', label: 'Selesai (Resolved)' },
  CLOSED: { color: 'default', label: 'Ditutup (Closed)' },
};

export const AdminFeedbackPage: React.FC = () => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail / Action modal
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusForm] = Form.useForm();

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const res = await feedbackApi.list({
        category: selectedCategory,
        status: selectedStatus,
        search: searchQuery || undefined,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      });
      setFeedbacks(res.data);
      setTotal(res.total);
    } catch (err: unknown) {
      message.error('Gagal memuat daftar masukan & feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, [currentPage, pageSize, selectedCategory, selectedStatus]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchFeedbacks();
  };

  const handleOpenDetail = (item: FeedbackItem) => {
    setSelectedFeedback(item);
    statusForm.setFieldsValue({
      status: item.status,
      adminNotes: item.adminNotes || '',
    });
    setIsModalOpen(true);
  };

  const handleUpdateStatus = async (values: { status: FeedbackStatus; adminNotes?: string }) => {
    if (!selectedFeedback) return;
    setIsUpdating(true);
    try {
      const res = await feedbackApi.updateStatus(selectedFeedback.id, values);
      message.success('Status masukan berhasil diperbarui!');
      setSelectedFeedback(res.data);
      setIsModalOpen(false);
      fetchFeedbacks();
    } catch (err: unknown) {
      message.error('Gagal memperbarui status masukan');
    } finally {
      setIsUpdating(false);
    }
  };

  const columns: TableProps<FeedbackItem>['columns'] = [
    {
      title: 'Waktu',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (val: string) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12, fontWeight: 500 }}>
            {formatDate(val)}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {formatRelativeTime(val)}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Pengirim & Halaman',
      key: 'sender',
      width: 190,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontSize: 13, display: 'block' }}>
            {r.userFullName || 'Pengguna Sistem'}
          </Text>
          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
            {r.userEmail || '-'}
          </Text>
          <Space size={4} wrap style={{ marginTop: 2 }}>
            <Tag color="purple" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
              {r.activeRole}
            </Tag>
            <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r.pageUrl}
            </Tag>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Kategori',
      key: 'category',
      width: 130,
      render: (_, r) => {
        const cat = CATEGORY_TAGS[r.category] || CATEGORY_TAGS.FEEDBACK;
        const urg = URGENCY_TAGS[r.urgency] || URGENCY_TAGS.MEDIUM;
        return (
          <Space direction="vertical" size={3}>
            <Tag color={cat.color} icon={cat.icon} style={{ margin: 0 }}>
              {cat.label}
            </Tag>
            {r.category === 'BUG' && (
              <Tag color={urg.color} style={{ fontSize: 11, margin: 0 }}>
                {urg.label}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Deskripsi Masukan & Laporan',
      key: 'description',
      minWidth: 350,
      render: (_, r) => (
        <div>
          {r.title && (
            <Text strong style={{ display: 'block', fontSize: 13, marginBottom: 2, color: '#1f1f1f' }}>
              {r.title}
            </Text>
          )}
          <Paragraph
            ellipsis={{ rows: 3, expandable: true, symbol: 'lihat selengkapnya' }}
            style={{ marginBottom: 0, fontSize: 13, color: '#595959', lineHeight: '1.5' }}
          >
            {r.description}
          </Paragraph>
        </div>
      ),
    },
    {
      title: 'Layar',
      dataIndex: 'screenshotData',
      key: 'screenshotData',
      width: 75,
      align: 'center',
      render: (val: string | null) =>
        val ? (
          <Image
            src={val}
            alt="Screenshot"
            width={42}
            height={32}
            style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid #d9d9d9' }}
          />
        ) : (
          <Text type="secondary" style={{ fontSize: 11 }}>
            -
          </Text>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (val: FeedbackStatus) => {
        const st = STATUS_TAGS[val] || STATUS_TAGS.OPEN;
        return <Tag color={st.color} style={{ margin: 0 }}>{st.label}</Tag>;
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 80,
      align: 'center',
      render: (_, r) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleOpenDetail(r)}
          style={{ padding: 0 }}
        >
          Detail
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="Pusat Masukan & Laporan Kendala"
        subtitle="Kelola tiket masukan, laporan kendala teknis, dan usulan fitur dari pengguna aplikasi NusaProc."
        icon={<CommentOutlined style={{ color: token.colorPrimary }} />}
        breadcrumbs={[
          { title: 'Admin' },
          { title: 'Masukan & Kendala' },
        ]}
      />

      <Card>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Input
              placeholder="Cari deskripsi, judul, nama..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 260 }}
              allowClear
            />

            <Select
              placeholder="Filter Kategori"
              allowClear
              value={selectedCategory}
              onChange={(val) => {
                setSelectedCategory(val);
                setCurrentPage(1);
              }}
              style={{ width: 170 }}
            >
              <Select.Option value="BUG">🐛 Bug / Kendala</Select.Option>
              <Select.Option value="FEATURE_REQUEST">💡 Usulan Fitur</Select.Option>
              <Select.Option value="FEEDBACK">💬 Masukan Umum</Select.Option>
            </Select>

            <Select
              placeholder="Filter Status"
              allowClear
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val);
                setCurrentPage(1);
              }}
              style={{ width: 170 }}
            >
              <Select.Option value="OPEN">Terbuka (Open)</Select.Option>
              <Select.Option value="IN_PROGRESS">Sedang Diproses</Select.Option>
              <Select.Option value="RESOLVED">Selesai (Resolved)</Select.Option>
              <Select.Option value="CLOSED">Ditutup (Closed)</Select.Option>
            </Select>

            <Button type="primary" onClick={handleSearch}>
              Filter
            </Button>
          </Space>

          <Button icon={<ReloadOutlined />} onClick={fetchFeedbacks} loading={loading}>
            Muat Ulang
          </Button>
        </Space>
      </Card>

      <Card>
        <Table<FeedbackItem>
          rowKey="id"
          columns={columns}
          dataSource={feedbacks}
          loading={loading}
          scroll={{ x: 1050 }}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, s) => {
              setCurrentPage(p);
              setPageSize(s);
            },
          }}
        />
      </Card>

      {/* Detail & Status Update Modal */}
      <Modal
        title={
          <Space>
            <CommentOutlined style={{ color: token.colorPrimary }} />
            <span>Detail Masukan & Laporan Pengguna</span>
          </Space>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={750}
      >
        {selectedFeedback && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Pengirim">
                {selectedFeedback.userFullName || 'Pengguna'} ({selectedFeedback.userEmail || '-'})
              </Descriptions.Item>
              <Descriptions.Item label="Peran Aktif">
                <Tag color="purple">{selectedFeedback.activeRole}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Kategori">
                <Tag color={CATEGORY_TAGS[selectedFeedback.category]?.color}>
                  {CATEGORY_TAGS[selectedFeedback.category]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Urgensi">
                <Tag color={URGENCY_TAGS[selectedFeedback.urgency]?.color}>
                  {URGENCY_TAGS[selectedFeedback.urgency]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Halaman URL" span={2}>
                <Tag color="blue">{selectedFeedback.pageUrl}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Waktu Lapor" span={2}>
                {formatDateTime(selectedFeedback.createdAt)}
              </Descriptions.Item>
            </Descriptions>

            {selectedFeedback.title && (
              <div style={{ marginBottom: 12 }}>
                <Text strong>Judul Masukan:</Text>
                <div style={{ padding: '6px 12px', background: '#f5f5f5', borderRadius: 4, marginTop: 4 }}>
                  {selectedFeedback.title}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <Text strong>Deskripsi Kendala / Masukan:</Text>
              <div
                style={{
                  padding: '10px 14px',
                  background: '#fafafa',
                  border: '1px solid #f0f0f0',
                  borderRadius: 4,
                  marginTop: 4,
                  whiteSpace: 'pre-wrap',
                  fontSize: 13,
                }}
              >
                {selectedFeedback.description}
              </div>
            </div>

            {selectedFeedback.screenshotData && (
              <div style={{ marginBottom: 20 }}>
                <Text strong>Tangkapan Layar (Screenshot):</Text>
                <div
                  style={{
                    textAlign: 'center',
                    background: '#f0f2f5',
                    padding: 12,
                    borderRadius: 6,
                    marginTop: 6,
                    border: '1px solid #d9d9d9',
                  }}
                >
                  <Image
                    src={selectedFeedback.screenshotData}
                    alt="Tangkapan Layar Pengguna"
                    style={{ maxHeight: 300, objectFit: 'contain', borderRadius: 4 }}
                  />
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Klik gambar untuk memperbesar resolusi asli
                    </Text>
                  </div>
                </div>
              </div>
            )}

            {selectedFeedback.systemInfo && (
              <div style={{ marginBottom: 20 }}>
                <Text strong>Informasi Perangkat & Browser:</Text>
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#f9f9f9',
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    marginTop: 4,
                  }}
                >
                  <div>Resolusi: {String(selectedFeedback.systemInfo.screenWidth)} x {String(selectedFeedback.systemInfo.screenHeight)}</div>
                  <div>User Agent: {String(selectedFeedback.systemInfo.userAgent)}</div>
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
              <Title level={5} style={{ marginBottom: 12 }}>
                Tindak Lanjut Administrator
              </Title>

              <Form form={statusForm} layout="vertical" onFinish={handleUpdateStatus}>
                <Form.Item name="status" label="Status Penanganan" rules={[{ required: true }]}>
                  <Select>
                    <Select.Option value="OPEN">Terbuka (Open)</Select.Option>
                    <Select.Option value="IN_PROGRESS">Sedang Diproses (In Progress)</Select.Option>
                    <Select.Option value="RESOLVED">Selesai (Resolved)</Select.Option>
                    <Select.Option value="CLOSED">Ditutup (Closed)</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item name="adminNotes" label="Catatan Internal / Solusi">
                  <TextArea rows={3} placeholder="Tuliskan catatan perbaikan atau penjelasan tindak lanjut..." />
                </Form.Item>

                <div style={{ textAlign: 'right', marginTop: 16 }}>
                  <Space>
                    <Button onClick={() => setIsModalOpen(false)}>Tutup</Button>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<CheckCircleOutlined />}
                      loading={isUpdating}
                    >
                      Simpan Perubahan
                    </Button>
                  </Space>
                </div>
              </Form>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminFeedbackPage;
