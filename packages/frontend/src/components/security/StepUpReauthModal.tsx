import React, { useState } from 'react';
import { Modal, Form, Input, Typography, Alert, Space } from 'antd';
import { LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useReauthStore } from '../../stores/useReauthStore';
import { useAuthStore } from '../../stores/useAuthStore';

const { Text } = Typography;

export const StepUpReauthModal: React.FC = () => {
  const { isOpen, targetAction, errorDetail, closeModal, confirmReauth } = useReauthStore();
  const { user } = useAuthStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      setError(null);

      const simulatedReauthToken = `reauth_token_${user?.id || 'guest'}_${Date.now()}_${targetAction || 'ACTION'}`;

      if (values.credential && values.credential.length >= 4) {
        confirmReauth(simulatedReauthToken);
        form.resetFields();
      } else {
        setError('Kode OTP atau kata sandi tidak valid.');
      }
    } catch {
      // Form validation error
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setError(null);
    closeModal();
  };

  return (
    <Modal
      title={
        <Space>
          <SafetyCertificateOutlined style={{ color: '#0052CC', fontSize: 20 }} />
          <span>Konfirmasi Tindakan Berisiko Tinggi (Step-Up Re-Auth)</span>
        </Space>
      }
      open={isOpen}
      onCancel={handleCancel}
      onOk={handleVerify}
      confirmLoading={loading}
      okText="Verifikasi & Lanjutkan"
      cancelText="Batalkan Tindakan"
      maskClosable={false}
      destroyOnClose
    >
      <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 8 }}>
        <Alert
          type="warning"
          showIcon
          message="Verifikasi Tambahan Diperlukan (R5, R43)"
          description={
            errorDetail ||
            `Tindakan (${targetAction || 'Aksi Sensitif'}) membutuhkan verifikasi ulang PIN / Kata Sandi atau TOTP Anda.`
          }
        />

        {error && <Alert type="error" showIcon message={error} />}

        <Form form={form} layout="vertical" onFinish={handleVerify}>
          <Form.Item
            name="credential"
            label="Kata Sandi / Kode TOTP 6-Digit"
            rules={[
              { required: true, message: 'Masukkan kata sandi atau kode TOTP Anda' },
              { min: 4, message: 'Minimal 4 karakter atau 6 digit' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Masukkan password atau kode Google Authenticator"
              autoFocus
            />
          </Form.Item>
        </Form>

        <Text type="secondary" style={{ fontSize: 12 }}>
          Verifikasi ini berlaku selama 5 menit untuk tindakan yang diminta saat ini.
        </Text>
      </Space>
    </Modal>
  );
};

export default StepUpReauthModal;
