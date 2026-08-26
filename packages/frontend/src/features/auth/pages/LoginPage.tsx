import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, Divider, Alert, Select } from 'antd';
import { UserOutlined, LockOutlined, GoogleOutlined, SafetyCertificateOutlined, LoginOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/useAuthStore';
import { loginWithPassword, loginWithGoogle } from '../../../api/endpoints/auth';
import type { AppRole } from '@nusaproc/shared';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              type?: 'standard' | 'icon';
              text?: 'signin_with' | 'signup_with' | 'continue_with';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number | string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const { Title, Text } = Typography;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gisReady, setGisReady] = useState(false);
  const [form] = Form.useForm();

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Initialize real Google Identity Services SDK
  useEffect(() => {
    if (!googleClientId) return;

    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(interval);
        setGisReady(true);

        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: { credential: string }) => {
            setLoading(true);
            setErrorMessage(null);
            try {
              const result = await loginWithGoogle({ credential: response.credential });
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
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const btnDiv = document.getElementById('google-sso-btn');
        if (btnDiv) {
          window.google.accounts.id.renderButton(btnDiv, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 376,
          });
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [googleClientId, navigate, setToken, setUser]);

  const handlePasswordLogin = async (values: { email: string; password: string; requestedRole?: AppRole }) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await loginWithPassword({
        email: values.email.trim(),
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

  const handleGoogleSsoFallback = async () => {
    if (window.google?.accounts?.id && googleClientId) {
      window.google.accounts.id.prompt();
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const email = form.getFieldValue('email')?.trim() || 'budi.santoso@nusanet.net.id';
      const name = email === 'budi.santoso@nusanet.net.id' ? 'Budi Santoso' : email.split('@')[0].replace(/\./g, ' ').toUpperCase();
      const mockPayload = JSON.stringify({
        email,
        name,
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
          maxWidth: 440,
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: 'none',
        }}
        bodyStyle={{ padding: '36px 32px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
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
            {import.meta.env.VITE_APP_NAME || 'NusaProc'}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {import.meta.env.VITE_APP_SUBTITLE || 'Sistem Pengadaan Terpadu PT Nusanet'}
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
              autoComplete="email"
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
              autoComplete="current-password"
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
        {googleClientId ? (
          <div>
            <div
              id="google-sso-btn"
              style={{
                display: 'flex',
                justifyContent: 'center',
                minHeight: 44,
                marginBottom: gisReady ? 0 : 8,
              }}
            />
            {!gisReady && (
              <Button
                size="large"
                block
                icon={<GoogleOutlined style={{ color: '#EA4335' }} />}
                onClick={handleGoogleSsoFallback}
                loading={loading}
                style={{
                  borderColor: '#d9d9d9',
                  fontWeight: 500,
                  height: 44,
                }}
              >
                Masuk dengan Google Workspace
              </Button>
            )}
          </div>
        ) : (
          <Button
            size="large"
            block
            icon={<GoogleOutlined style={{ color: '#EA4335' }} />}
            onClick={handleGoogleSsoFallback}
            loading={loading}
            style={{
              borderColor: '#d9d9d9',
              fontWeight: 500,
              height: 44,
            }}
          >
            Masuk dengan Google Workspace
          </Button>
        )}
      </Card>
    </div>
  );
};
