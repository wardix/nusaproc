import React, { useState } from 'react';
import { Modal, Form, Input, Typography } from 'antd';

const { Text } = Typography;

export const StepUpReauthModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Modal
      title="Konfirmasi Tindakan Berisiko Tinggi (Step-Up Re-Auth)"
      open={isOpen}
      onCancel={() => setIsOpen(false)}
      okText="Verifikasi & Lanjutkan"
      cancelText="Batal"
    >
      <Text type="secondary">
        Tindakan ini memerlukan verifikasi ulang kredensial atau kode TOTP Anda.
      </Text>
      <Form layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="Kode TOTP / Kata Sandi" required>
          <Input.Password placeholder="Masukkan 6 digit TOTP / password" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
