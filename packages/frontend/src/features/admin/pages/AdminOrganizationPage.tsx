import React, { useState } from 'react';
import {
  Table,
  Button,
  Tag,
  Card,
  Typography,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Tabs,
  Row,
  Col,
  Popconfirm,
} from 'antd';
import {
  BankOutlined,
  ApartmentOutlined,
  PlusOutlined,
  EditOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  branchesApi,
  divisionsApi,
  type BranchItem,
  type DivisionItem,
  type CreateBranchPayload,
  type UpdateBranchPayload,
  type CreateDivisionPayload,
  type UpdateDivisionPayload,
} from '../../../api';

const { Title, Text, Paragraph } = Typography;

export const AdminOrganizationPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'branches' | 'divisions'>('branches');

  // Branch states
  const [branchSearch, setBranchSearch] = useState('');
  const [branchStatusFilter, setBranchStatusFilter] = useState<boolean | undefined>(undefined);
  const [isCreateBranchModalOpen, setIsCreateBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);
  const [createBranchForm] = Form.useForm<CreateBranchPayload>();
  const [editBranchForm] = Form.useForm<UpdateBranchPayload>();

  // Division states
  const [divisionSearch, setDivisionSearch] = useState('');
  const [divisionStatusFilter, setDivisionStatusFilter] = useState<boolean | undefined>(undefined);
  const [isCreateDivisionModalOpen, setIsCreateDivisionModalOpen] = useState(false);
  const [editingDivision, setEditingDivision] = useState<DivisionItem | null>(null);
  const [createDivisionForm] = Form.useForm<CreateDivisionPayload>();
  const [editDivisionForm] = Form.useForm<UpdateDivisionPayload>();

  // Queries
  const { data: branchesData, isLoading: isBranchesLoading } = useQuery({
    queryKey: ['branches', branchStatusFilter, branchSearch],
    queryFn: () => branchesApi.list({ isActive: branchStatusFilter, search: branchSearch }),
  });

  const { data: divisionsData, isLoading: isDivisionsLoading } = useQuery({
    queryKey: ['divisions', divisionStatusFilter, divisionSearch],
    queryFn: () => divisionsApi.list({ isActive: divisionStatusFilter, search: divisionSearch }),
  });

  const branches = branchesData?.data || [];
  const divisions = divisionsData?.data || [];

  // Branch Mutations
  const createBranchMutation = useMutation({
    mutationFn: (payload: CreateBranchPayload) => branchesApi.create(payload),
    onSuccess: () => {
      message.success('Kantor cabang baru berhasil ditambahkan.');
      setIsCreateBranchModalOpen(false);
      createBranchForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal menambahkan kantor cabang.');
    },
  });

  const updateBranchMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBranchPayload }) =>
      branchesApi.update(id, payload),
    onSuccess: () => {
      message.success('Data kantor cabang berhasil diperbarui.');
      setEditingBranch(null);
      editBranchForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal memperbarui kantor cabang.');
    },
  });

  const toggleBranchStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      branchesApi.toggleStatus(id, isActive),
    onSuccess: (_, variables) => {
      message.success(
        variables.isActive
          ? 'Kantor cabang berhasil diaktifkan kembali.'
          : 'Kantor cabang berhasil dinonaktifkan.'
      );
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal mengubah status cabang.');
    },
  });

  // Division Mutations
  const createDivisionMutation = useMutation({
    mutationFn: (payload: CreateDivisionPayload) => divisionsApi.create(payload),
    onSuccess: () => {
      message.success('Divisi baru berhasil ditambahkan.');
      setIsCreateDivisionModalOpen(false);
      createDivisionForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal menambahkan divisi.');
    },
  });

  const updateDivisionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDivisionPayload }) =>
      divisionsApi.update(id, payload),
    onSuccess: () => {
      message.success('Data divisi berhasil diperbarui.');
      setEditingDivision(null);
      editDivisionForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal memperbarui divisi.');
    },
  });

  const toggleDivisionStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      divisionsApi.toggleStatus(id, isActive),
    onSuccess: (_, variables) => {
      message.success(
        variables.isActive
          ? 'Divisi berhasil diaktifkan kembali.'
          : 'Divisi berhasil dinonaktifkan.'
      );
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal mengubah status divisi.');
    },
  });

  // Open Edit Branch Modal
  const handleOpenEditBranch = (branch: BranchItem) => {
    setEditingBranch(branch);
    editBranchForm.setFieldsValue({
      code: branch.code,
      name: branch.name,
      city: branch.city,
      address: branch.address,
      isActive: branch.isActive,
    });
  };

  // Open Edit Division Modal
  const handleOpenEditDivision = (division: DivisionItem) => {
    setEditingDivision(division);
    editDivisionForm.setFieldsValue({
      code: division.code,
      name: division.name,
      description: division.description,
      isActive: division.isActive,
    });
  };

  // Branch Table Columns
  const branchColumns = [
    {
      title: 'Kode Cabang',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => (
        <Tag color="geekblue" style={{ fontWeight: 600, fontSize: 13 }}>
          {code}
        </Tag>
      ),
    },
    {
      title: 'Nama Kantor Cabang',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Kota / Wilayah',
      dataIndex: 'city',
      key: 'city',
      render: (city: string) => <Tag color="cyan">{city}</Tag>,
    },
    {
      title: 'Alamat Kantor',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      render: (address: string | null) => (
        <Paragraph style={{ margin: 0 }} ellipsis={{ rows: 2, tooltip: address || '-' }}>
          {address || '-'}
        </Paragraph>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) =>
        isActive ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            AKTIF
          </Tag>
        ) : (
          <Tag icon={<StopOutlined />} color="error">
            NONAKTIF
          </Tag>
        ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      render: (_: unknown, record: BranchItem) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditBranch(record)}
          >
            Edit
          </Button>
          {record.isActive ? (
            <Popconfirm
              title="Nonaktifkan Cabang?"
              description="Cabang non-aktif tidak akan muncul di formulir pengajuan baru."
              okText="Ya, Nonaktifkan"
              cancelText="Batal"
              onConfirm={() =>
                toggleBranchStatusMutation.mutate({ id: record.id, isActive: false })
              }
            >
              <Button size="small" danger>
                Nonaktifkan
              </Button>
            </Popconfirm>
          ) : (
            <Button
              size="small"
              type="dashed"
              onClick={() =>
                toggleBranchStatusMutation.mutate({ id: record.id, isActive: true })
              }
            >
              Aktifkan
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // Division Table Columns
  const divisionColumns = [
    {
      title: 'Kode Divisi',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => (
        <Tag color="purple" style={{ fontWeight: 600, fontSize: 13 }}>
          {code}
        </Tag>
      ),
    },
    {
      title: 'Nama Divisi',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Deskripsi Tanggung Jawab',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string | null) => (
        <Paragraph style={{ margin: 0 }} ellipsis={{ rows: 2, tooltip: desc || '-' }}>
          {desc || '-'}
        </Paragraph>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) =>
        isActive ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            AKTIF
          </Tag>
        ) : (
          <Tag icon={<StopOutlined />} color="error">
            NONAKTIF
          </Tag>
        ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      render: (_: unknown, record: DivisionItem) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditDivision(record)}
          >
            Edit
          </Button>
          {record.isActive ? (
            <Popconfirm
              title="Nonaktifkan Divisi?"
              description="Divisi non-aktif tidak akan muncul di formulir pengajuan baru."
              okText="Ya, Nonaktifkan"
              cancelText="Batal"
              onConfirm={() =>
                toggleDivisionStatusMutation.mutate({ id: record.id, isActive: false })
              }
            >
              <Button size="small" danger>
                Nonaktifkan
              </Button>
            </Popconfirm>
          ) : (
            <Button
              size="small"
              type="dashed"
              onClick={() =>
                toggleDivisionStatusMutation.mutate({ id: record.id, isActive: true })
              }
            >
              Aktifkan
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0px' }}>
      {/* Top Banner */}
      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space align="center" size="middle">
              <BankOutlined style={{ fontSize: 28, color: '#0052CC' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  Manajemen Master Data Organisasi (Kantor Cabang & Divisi)
                </Title>
                <Text type="secondary">
                  Kelola struktur kantor cabang dan divisi internal PT Nusanet secara terpusat untuk alur pengadaan & hak akses.
                </Text>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Main Tabs */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'branches' | 'divisions')}
          items={[
            {
              key: 'branches',
              label: (
                <span>
                  <BankOutlined />
                  Kantor Cabang ({branches.length})
                </span>
              ),
              children: (
                <div>
                  <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={16} md={12}>
                      <Space wrap>
                        <Input
                          placeholder="Cari kode, nama, kota..."
                          prefix={<SearchOutlined />}
                          value={branchSearch}
                          onChange={(e) => setBranchSearch(e.target.value)}
                          allowClear
                          style={{ width: 240 }}
                        />
                        <Select
                          placeholder="Status Cabang"
                          style={{ width: 160 }}
                          allowClear
                          value={branchStatusFilter}
                          onChange={setBranchStatusFilter}
                        >
                          <Select.Option value={true}>Hanya Aktif</Select.Option>
                          <Select.Option value={false}>Hanya Nonaktif</Select.Option>
                        </Select>
                      </Space>
                    </Col>
                    <Col>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setIsCreateBranchModalOpen(true)}
                        style={{ background: '#0052CC' }}
                      >
                        Tambah Kantor Cabang
                      </Button>
                    </Col>
                  </Row>

                  <Table
                    columns={branchColumns}
                    dataSource={branches}
                    rowKey="id"
                    loading={isBranchesLoading}
                    pagination={{ pageSize: 10, showTotal: (total) => `Total ${total} kantor cabang` }}
                  />
                </div>
              ),
            },
            {
              key: 'divisions',
              label: (
                <span>
                  <ApartmentOutlined />
                  Divisi Perusahaan ({divisions.length})
                </span>
              ),
              children: (
                <div>
                  <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={16} md={12}>
                      <Space wrap>
                        <Input
                          placeholder="Cari kode, nama divisi..."
                          prefix={<SearchOutlined />}
                          value={divisionSearch}
                          onChange={(e) => setDivisionSearch(e.target.value)}
                          allowClear
                          style={{ width: 240 }}
                        />
                        <Select
                          placeholder="Status Divisi"
                          style={{ width: 160 }}
                          allowClear
                          value={divisionStatusFilter}
                          onChange={setDivisionStatusFilter}
                        >
                          <Select.Option value={true}>Hanya Aktif</Select.Option>
                          <Select.Option value={false}>Hanya Nonaktif</Select.Option>
                        </Select>
                      </Space>
                    </Col>
                    <Col>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setIsCreateDivisionModalOpen(true)}
                        style={{ background: '#0052CC' }}
                      >
                        Tambah Divisi
                      </Button>
                    </Col>
                  </Row>

                  <Table
                    columns={divisionColumns}
                    dataSource={divisions}
                    rowKey="id"
                    loading={isDivisionsLoading}
                    pagination={{ pageSize: 10, showTotal: (total) => `Total ${total} divisi` }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Modal: Tambah Kantor Cabang */}
      <Modal
        title="Tambah Kantor Cabang Baru"
        open={isCreateBranchModalOpen}
        onCancel={() => {
          setIsCreateBranchModalOpen(false);
          createBranchForm.resetFields();
        }}
        onOk={() => createBranchForm.submit()}
        confirmLoading={createBranchMutation.isPending}
        okText="Simpan Kantor Cabang"
        cancelText="Batal"
      >
        <Form
          form={createBranchForm}
          layout="vertical"
          onFinish={(values) => createBranchMutation.mutate(values)}
          initialValues={{ isActive: true }}
        >
          <Form.Item
            name="code"
            label="Kode Cabang"
            rules={[
              { required: true, message: 'Kode cabang wajib diisi' },
              { min: 2, message: 'Minimal 2 karakter' },
              { pattern: /^[A-Z0-9_-]+$/i, message: 'Gunakan huruf, angka, -, atau _' },
            ]}
          >
            <Input placeholder="Contoh: BRANCH-BALI-01" />
          </Form.Item>

          <Form.Item
            name="name"
            label="Nama Kantor Cabang"
            rules={[{ required: true, message: 'Nama kantor cabang wajib diisi' }]}
          >
            <Input placeholder="Contoh: Kantor Cabang Denpasar Bali" />
          </Form.Item>

          <Form.Item
            name="city"
            label="Kota / Wilayah"
            rules={[{ required: true, message: 'Nama kota wajib diisi' }]}
          >
            <Input placeholder="Contoh: Denpasar" />
          </Form.Item>

          <Form.Item name="address" label="Alamat Kantor (Opsional)">
            <Input.TextArea rows={3} placeholder="Contoh: Jl. Teuku Umar No. 88, Denpasar Barat" />
          </Form.Item>

          <Form.Item name="isActive" label="Status Aktif" valuePropName="checked">
            <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Edit Kantor Cabang */}
      <Modal
        title={`Edit Kantor Cabang: ${editingBranch?.name || ''}`}
        open={!!editingBranch}
        onCancel={() => setEditingBranch(null)}
        onOk={() => editBranchForm.submit()}
        confirmLoading={updateBranchMutation.isPending}
        okText="Perbarui Cabang"
        cancelText="Batal"
      >
        <Form
          form={editBranchForm}
          layout="vertical"
          onFinish={(values) => {
            if (editingBranch) {
              updateBranchMutation.mutate({ id: editingBranch.id, payload: values });
            }
          }}
        >
          <Form.Item
            name="code"
            label="Kode Cabang"
            rules={[
              { required: true, message: 'Kode cabang wajib diisi' },
              { pattern: /^[A-Z0-9_-]+$/i, message: 'Gunakan huruf, angka, -, atau _' },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="name"
            label="Nama Kantor Cabang"
            rules={[{ required: true, message: 'Nama kantor cabang wajib diisi' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="city"
            label="Kota / Wilayah"
            rules={[{ required: true, message: 'Nama kota wajib diisi' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="address" label="Alamat Kantor">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item name="isActive" label="Status Aktif" valuePropName="checked">
            <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Tambah Divisi */}
      <Modal
        title="Tambah Divisi Baru"
        open={isCreateDivisionModalOpen}
        onCancel={() => {
          setIsCreateDivisionModalOpen(false);
          createDivisionForm.resetFields();
        }}
        onOk={() => createDivisionForm.submit()}
        confirmLoading={createDivisionMutation.isPending}
        okText="Simpan Divisi"
        cancelText="Batal"
      >
        <Form
          form={createDivisionForm}
          layout="vertical"
          onFinish={(values) => createDivisionMutation.mutate(values)}
          initialValues={{ isActive: true }}
        >
          <Form.Item
            name="code"
            label="Kode Divisi"
            rules={[
              { required: true, message: 'Kode divisi wajib diisi' },
              { min: 2, message: 'Minimal 2 karakter' },
              { pattern: /^[A-Z0-9_-]+$/i, message: 'Gunakan huruf, angka, -, atau _' },
            ]}
          >
            <Input placeholder="Contoh: DIV-SEC" />
          </Form.Item>

          <Form.Item
            name="name"
            label="Nama Divisi"
            rules={[{ required: true, message: 'Nama divisi wajib diisi' }]}
          >
            <Input placeholder="Contoh: Divisi Keamanan Siber & Kepatuhan" />
          </Form.Item>

          <Form.Item name="description" label="Deskripsi Tanggung Jawab">
            <Input.TextArea rows={3} placeholder="Contoh: Bertanggung jawab atas keamanan sistem dan audit ISO" />
          </Form.Item>

          <Form.Item name="isActive" label="Status Aktif" valuePropName="checked">
            <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Edit Divisi */}
      <Modal
        title={`Edit Divisi: ${editingDivision?.name || ''}`}
        open={!!editingDivision}
        onCancel={() => setEditingDivision(null)}
        onOk={() => editDivisionForm.submit()}
        confirmLoading={updateDivisionMutation.isPending}
        okText="Perbarui Divisi"
        cancelText="Batal"
      >
        <Form
          form={editDivisionForm}
          layout="vertical"
          onFinish={(values) => {
            if (editingDivision) {
              updateDivisionMutation.mutate({ id: editingDivision.id, payload: values });
            }
          }}
        >
          <Form.Item
            name="code"
            label="Kode Divisi"
            rules={[
              { required: true, message: 'Kode divisi wajib diisi' },
              { pattern: /^[A-Z0-9_-]+$/i, message: 'Gunakan huruf, angka, -, atau _' },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="name"
            label="Nama Divisi"
            rules={[{ required: true, message: 'Nama divisi wajib diisi' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="description" label="Deskripsi Tanggung Jawab">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item name="isActive" label="Status Aktif" valuePropName="checked">
            <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminOrganizationPage;
