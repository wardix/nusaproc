import React, { useState, useMemo } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Checkbox,
  Switch,
  App,
  theme,
  Popconfirm,
  Typography,
  Card,
  Row,
  Col,
} from 'antd';
import {
  UserAddOutlined,
  SearchOutlined,
  EditOutlined,
  CheckCircleOutlined,
  StopOutlined,
  KeyOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchUsers,
  createUser,
  updateUserRoles,
  updateUserStatus,
  branchesApi,
  divisionsApi,
  type UserItem,
  type CreateUserPayload,
} from '../../../api';
import type { AppRole } from '@nusaproc/shared';
import { PageHeader } from '../../../components/common/PageHeader';
import { RoleTag, StatusTag, ROLE_COLORS, ROLE_LABELS } from '../../../components/common/StatusTag';

const { Text } = Typography;

const ALL_ROLES: { label: string; value: AppRole; color: string }[] = (
  ['REQUESTER', 'APPROVER', 'ACCOUNT_PAYABLE', 'WAREHOUSE', 'FINANCE', 'AUDITOR', 'ADMIN'] as AppRole[]
).map((r) => ({
  value: r,
  label: ROLE_LABELS[r] || r,
  color: ROLE_COLORS[r] || 'blue',
}));

export const AdminUsersPage: React.FC = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [divisionFilter, setDivisionFilter] = useState<string | undefined>(undefined);
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditRolesModalOpen, setIsEditRolesModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  const [createForm] = Form.useForm();
  const [editRolesForm] = Form.useForm();

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['users', searchTerm, divisionFilter, roleFilter, statusFilter],
    queryKeyHashFn: (queryKey) => JSON.stringify(queryKey),
    queryFn: () =>
      fetchUsers({
        search: searchTerm || undefined,
        divisionId: divisionFilter || undefined,
        role: roleFilter || undefined,
        isActive: statusFilter,
      }),
  });

  const { data: branchesData } = useQuery({
    queryKey: ['branches', true],
    queryFn: () => branchesApi.list({ isActive: true }),
  });

  const { data: divisionsData } = useQuery({
    queryKey: ['divisions', true],
    queryFn: () => divisionsApi.list({ isActive: true }),
  });

  const activeBranches = branchesData?.data || [];
  const activeDivisions = divisionsData?.data || [];

  const branchMap = useMemo(() => {
    const map = new Map<string, string>();
    activeBranches.forEach((b) => map.set(b.code, b.name));
    return map;
  }, [activeBranches]);

  const divisionMap = useMemo(() => {
    const map = new Map<string, string>();
    activeDivisions.forEach((d) => map.set(d.code, d.name));
    return map;
  }, [activeDivisions]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => {
      message.success('Pengguna baru berhasil didaftarkan.');
      setIsCreateModalOpen(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal mendaftarkan pengguna.');
    },
  });

  const updateRolesMutation = useMutation({
    mutationFn: ({
      userId,
      roles,
    }: {
      userId: string;
      roles: Array<{ role: AppRole; isTaxSpecialist?: boolean; validFrom?: string; validUntil?: string | null }>;
    }) => updateUserRoles(userId, roles),
    onSuccess: () => {
      message.success('Hak akses peran berhasil diperbarui.');
      setIsEditRolesModalOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal memperbarui peran.');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateUserStatus(userId, isActive),
    onSuccess: (_, variables) => {
      message.success(
        variables.isActive
          ? 'Akun pengguna berhasil diaktifkan kembali.'
          : 'Akun pengguna berhasil dinonaktifkan. Seluruh delegasi terkait dibatalkan (R64).'
      );
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(errorObj.response?.data?.detail || errorObj.message || 'Gagal mengubah status pengguna.');
    },
  });

  const handleOpenEditRoles = (user: UserItem) => {
    setSelectedUser(user);
    const assignedRoleKeys = user.roles.map((r) => r.role);
    const hasTax = user.roles.some((r) => r.isTaxSpecialist);
    editRolesForm.setFieldsValue({
      roles: assignedRoleKeys,
      isTaxSpecialist: hasTax,
    });
    setIsEditRolesModalOpen(true);
  };

  const handleCreateSubmit = (values: {
    email: string;
    fullName: string;
    employeeId: string;
    divisionId: string;
    branchId: string;
    initialPassword?: string;
    roles: AppRole[];
    isTaxSpecialist?: boolean;
  }) => {
    const rolesPayload = values.roles.map((r: AppRole) => ({
      role: r,
      isTaxSpecialist: values.isTaxSpecialist && r === 'ACCOUNT_PAYABLE',
    }));

    createMutation.mutate({
      email: values.email,
      fullName: values.fullName,
      employeeId: values.employeeId,
      divisionId: values.divisionId,
      branchId: values.branchId,
      initialPassword: values.initialPassword || 'Password123!',
      isLocalFallback: true,
      roles: rolesPayload,
    });
  };

  const handleEditRolesSubmit = (values: {
    roles: AppRole[];
    isTaxSpecialist?: boolean;
  }) => {
    if (!selectedUser) return;
    const rolesPayload = values.roles.map((r: AppRole) => ({
      role: r,
      isTaxSpecialist: values.isTaxSpecialist && r === 'ACCOUNT_PAYABLE',
    }));

    updateRolesMutation.mutate({
      userId: selectedUser.id,
      roles: rolesPayload,
    });
  };

  const columns = [
    {
      title: 'Karyawan & NIP',
      key: 'employee',
      render: (_: unknown, record: UserItem) => (
        <div>
          <Text strong style={{ fontSize: 14 }}>
            {record.fullName}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.employeeId} • {record.email}
          </Text>
        </div>
      ),
    },
    {
      title: 'Divisi / Cabang',
      key: 'org',
      render: (_: unknown, record: UserItem) => {
        const divName = record.divisionName || divisionMap.get(record.divisionId) || record.divisionId;
        const brName = record.branchName || branchMap.get(record.branchId) || record.branchId;
        return (
          <Space direction="vertical" size={3}>
            <Tag color="geekblue" style={{ margin: 0, whiteSpace: 'normal', height: 'auto', padding: '2px 8px' }}>
              {divName}
            </Tag>
            <Tag color="default" style={{ margin: 0, whiteSpace: 'normal', height: 'auto', padding: '2px 8px' }}>
              {brName}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: 'Peran & Hak Akses (RBAC)',
      key: 'roles',
      render: (_: unknown, record: UserItem) => (
        <Space wrap size={[2, 4]}>
          {record.roles.map((r) => (
            <RoleTag key={r.role} role={r.role} isTaxSpecialist={r.isTaxSpecialist} />
          ))}
        </Space>
      ),
    },
    {
      title: 'Autentikasi',
      key: 'auth',
      render: (_: unknown, record: UserItem) => (
        <Space direction="vertical" size={2}>
          {record.isLocalFallback && (
            <Tag icon={<KeyOutlined />} color="purple">
              Local Password
            </Tag>
          )}
          <Tag icon={<SafetyCertificateOutlined />} color="blue">
            Google SSO
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      render: (isActive: boolean) => <StatusTag status={isActive} />,
    },
    {
      title: 'Aksi',
      key: 'actions',
      render: (_: unknown, record: UserItem) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditRoles(record)}
          >
            Edit Peran
          </Button>
          {record.isActive ? (
            <Popconfirm
              title="Nonaktifkan Pengguna?"
              description="Perhatian (R64): Menonaktifkan akun akan membatalkan seluruh delegasi aktif pengguna ini."
              okText="Ya, Nonaktifkan"
              cancelText="Batal"
              okButtonProps={{ danger: true }}
              onConfirm={() =>
                statusMutation.mutate({ userId: record.id, isActive: false })
              }
            >
              <Button size="small" danger icon={<StopOutlined />}>
                Nonaktifkan
              </Button>
            </Popconfirm>
          ) : (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<CheckCircleOutlined />}
              onClick={() =>
                statusMutation.mutate({ userId: record.id, isActive: true })
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Manajemen Pengguna & Hak Akses (US12)"
        subtitle="Kelola akun karyawan, hak akses multi-peran (RBAC), dan status aktifasi pengguna PT Nusanet."
        icon={<TeamOutlined />}
        extra={
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Tambah Pengguna Baru
          </Button>
        }
      />

      <Card>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Cari nama, email, NIP..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Filter Divisi"
              style={{ width: '100%' }}
              allowClear
              showSearch
              optionFilterProp="children"
              value={divisionFilter}
              onChange={setDivisionFilter}
            >
              {activeDivisions.map((d) => (
                <Select.Option key={d.code} value={d.code}>
                  {d.name}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Filter Peran"
              style={{ width: '100%' }}
              allowClear
              value={roleFilter}
              onChange={setRoleFilter}
            >
              {ALL_ROLES.map((r) => (
                <Select.Option key={r.value} value={r.value}>
                  {r.label}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Status Akun"
              style={{ width: '100%' }}
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Select.Option value={true}>Aktif</Select.Option>
              <Select.Option value={false}>Nonaktif</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          dataSource={data?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10, showTotal: (total) => `Total ${total} pengguna` }}
        />
      </Card>

      {/* Modal Tambah Pengguna Baru */}
      <Modal
        title="Pendaftaran Pengguna Baru (US12)"
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        footer={null}
        width={560}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateSubmit}
          initialValues={{
            branchId: 'HQ_MEDAN',
            divisionId: 'DIV-IT',
            initialPassword: 'Password123!',
            roles: ['REQUESTER'],
            isTaxSpecialist: false,
          }}
        >
          <Form.Item
            name="email"
            label="Alamat Email Karyawan"
            rules={[
              { required: true, message: 'Email wajib diisi' },
              { type: 'email', message: 'Format email tidak valid' },
            ]}
          >
            <Input placeholder="contoh@nusanet.net.id" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="fullName"
                label="Nama Lengkap"
                rules={[{ required: true, message: 'Nama lengkap wajib diisi' }]}
              >
                <Input placeholder="Nama Lengkap Karyawan" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="employeeId"
                label="NIP / Employee ID"
                rules={[{ required: true, message: 'NIP wajib diisi' }]}
              >
                <Input placeholder="EMP-XXXX" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="divisionId"
                label="Divisi"
                rules={[{ required: true, message: 'Divisi wajib dipilih' }]}
              >
                <Select placeholder="Pilih Divisi" showSearch optionFilterProp="children">
                  {activeDivisions.map((d) => (
                    <Select.Option key={d.code} value={d.code}>
                      {d.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="branchId"
                label="Cabang Kantor"
                rules={[{ required: true, message: 'Cabang wajib dipilih' }]}
              >
                <Select placeholder="Pilih Cabang" showSearch optionFilterProp="children">
                  {activeBranches.map((b) => (
                    <Select.Option key={b.code} value={b.code}>
                      {b.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="initialPassword"
            label="Kata Sandi Awal (Fallback Login)"
            rules={[{ min: 6, message: 'Kata sandi minimal 6 karakter' }]}
          >
            <Input.Password placeholder="Password123!" />
          </Form.Item>

          <Form.Item
            name="roles"
            label="Penetapan Peran (Multi-Role RBAC)"
            rules={[{ required: true, message: 'Minimal pilih 1 peran' }]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[8, 8]}>
                {ALL_ROLES.map((r) => (
                  <Col span={12} key={r.value}>
                    <Checkbox value={r.value}>
                      <Tag color={r.color}>{r.value}</Tag>
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item
            name="isTaxSpecialist"
            label="Spesialisasi Pajak (PPN/PPh Validator)"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setIsCreateModalOpen(false)}>Batal</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending}
              >
                Simpan & Daftarkan Pengguna
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* Modal Edit Hak Akses & Peran */}
      <Modal
        title={`Edit Peran & Hak Akses: ${selectedUser?.fullName || ''}`}
        open={isEditRolesModalOpen}
        onCancel={() => {
          setIsEditRolesModalOpen(false);
          setSelectedUser(null);
        }}
        footer={null}
        width={500}
      >
        <Form form={editRolesForm} layout="vertical" onFinish={handleEditRolesSubmit}>
          <Form.Item
            name="roles"
            label="Daftar Peran Aktif"
            rules={[{ required: true, message: 'Minimal pilih 1 peran' }]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[8, 12]}>
                {ALL_ROLES.map((r) => (
                  <Col span={12} key={r.value}>
                    <Checkbox value={r.value}>
                      <Tag color={r.color}>{r.value}</Tag>
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item
            name="isTaxSpecialist"
            label="Hak Akses Khusus Tax Specialist (PPN 12% & Coretax)"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button
                onClick={() => {
                  setIsEditRolesModalOpen(false);
                  setSelectedUser(null);
                }}
              >
                Batal
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateRolesMutation.isPending}
              >
                Perbarui Hak Akses
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
