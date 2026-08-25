import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Divider, Alert, Space, Select, Tag } from 'antd';
import { UserOutlined, LockOutlined, GoogleOutlined, SafetyCertificateOutlined, LoginOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/useAuthStore';
import { loginWithPassword, loginWithGoogle } from '../../../api/endpoints/auth';
import { DEMO_PERSONAS, type AppRole } from '@nusaproc/shared';

const { Title, Text, Paragraph } = Typography;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form] = Form.useForm();

  const handlePasswordLogin = async (values: { email: string; password: string; requestedRole?: AppRole }) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await loginWithPassword({
        email: values.email,
        password: values.password,
        requestedRole: values.requestedRole,
      });

      setToken(result.token);
      setUser(result.user);
      navigate('/dashboard');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = errorObj.response?.data?.detail || errorObj.message || 'Gagal masuk ke sistem.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSsoLogin = async (customEmail?: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const email = customEmail || 'budi.santoso@nusanet.net.id';
      const mockPayload = JSON.stringify({
        email,
        name: email.split('@')[0].replace(/\./g, ' ').toUpperCase(),
        hd: 'nusanet.net.id',
        sub: `google-${Date.now()}`,
      });

      const result = await loginWithGoogle({ credential: mockPayload });
      setToken(result.token);
      setUser(result.user);
      navigate('/dashboard');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = errorObj.response?.data?.detail || errorObj.message || 'Gagal autentikasi via Google Workspace.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePersonaQuickSelect = (persona: typeof DEMO_PERSONAS[0]) => {
    form.setFieldsValue({
      email: persona.email,
      password: 'Password123!',
      requestedRole: persona.role,
    });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #001529 0%, #003a8c 50%, #0052cc 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px 16px',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 460,
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: 'none',
        }}
        bodyStyle={{ padding: '36px 32px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 16,
              background: '#E6F4FF',
              color: '#0052CC',
              fontSize: 28,
              marginBottom: 12,
            }}
          >
            <SafetyCertificateOutlined />
          </div>
          <Title level={3} style={{ margin: 0, color: '#002766' }}>
            NusaProc
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Sistem Pengadaan Terpadu PT Nusanet
          </Text>
        </div>

        {errorMessage && (
          <Alert
            message="Gagal Masuk"
            description={errorMessage}
            type="error"
            showIcon
            closable
            onClose={() => setErrorMessage(null)}
            style={{ marginBottom: 20 }}
          />
        )}

        {/* Standard Local Email & Password Form */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handlePasswordLogin}
          initialValues={{
            email: 'budi.santoso@nusanet.net.id',
            password: 'Password123!',
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
            <Input
              prefix={<UserOutlined style={{ color: '#8c8c8c' }} />}
              placeholder="nama@nusanet.net.id"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Kata Sandi"
            rules={[{ required: true, message: 'Kata sandi wajib diisi' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
              placeholder="Masukkan kata sandi..."
              size="large"
            />
          </Form.Item>

          <Form.Item name="requestedRole" label="Peran Masuk (Opsional)">
            <Select size="large" allowClear placeholder="Pilih peran aktif...">
              <Select.Option value="REQUESTER">Requester (Pemohon PR)</Select.Option>
              <Select.Option value="APPROVER">Approver (Penyetuju PR/PO)</Select.Option>
              <Select.Option value="ACCOUNT_PAYABLE">Account Payable (Maker/Checker)</Select.Option>
              <Select.Option value="WAREHOUSE">Warehouse (Penerima BAST)</Select.Option>
              <Select.Option value="FINANCE">Finance (Treasury Executor)</Select.Option>
              <Select.Option value="AUDITOR">Auditor (Read-Only Trail)</Select.Option>
              <Select.Option value="ADMIN">Administrator Sistem</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              icon={<LoginOutlined />}
              style={{
                backgroundColor: '#0052CC',
                borderColor: '#0052CC',
                fontWeight: 600,
                height: 44,
              }}
            >
              Masuk dengan Email
            </Button>
          </Form.Item>
        </Form>

        <Divider plain style={{ margin: '16px 0', fontSize: 12, color: '#8c8c8c' }}>
          ATAU
        </Divider>

        {/* Google Workspace SSO Button */}
        <Button
          size="large"
          block
          icon={<GoogleOutlined style={{ color: '#EA4335' }} />}
          onClick={() => handleGoogleSsoLogin(form.getFieldValue('email'))}
          loading={loading}
          style={{
            borderColor: '#d9d9d9',
            fontWeight: 500,
            height: 44,
            marginBottom: 24,
          }}
        >
          Masuk dengan Google Workspace
        </Button>

        {/* Demo Fast Persona Selector */}
        <Card
          size="small"
          style={{
            background: '#FAFAFA',
            borderColor: '#F0F0F0',
            borderRadius: 8,
          }}
        >
          <Paragraph style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#595959' }}>
            ⚡ Akses Cepat Demo Persona:
          </Paragraph>
          <Space wrap size={[4, 6]} style={{ marginTop: 8 }}>
            {DEMO_PERSONAS.map((p) => (
              <Tag
                key={p.id}
                color={p.role === 'ADMIN' ? 'purple' : p.role === 'FINANCE' ? 'gold' : 'blue'}
                style={{ cursor: 'pointer', padding: '2px 8px', fontSize: 11 }}
                onClick={() => handlePersonaQuickSelect(p)}
              >
                {p.fullName.split(' ')[0]} ({p.role})
              </Tag>
            ))}
          </Space>
        </Card>
      </Card>
    </div>
  );
};
