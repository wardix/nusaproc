import React from 'react';
import { Dropdown, Space, Avatar, Tag, Typography } from 'antd';
import { UserOutlined, DownOutlined, CheckOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../stores/useAuthStore';
import type { AppRole } from '@nusaproc/shared';

const { Text } = Typography;

const ROLE_LABELS: Record<AppRole, string> = {
  REQUESTER: 'Pengaju (Requester)',
  APPROVER: 'Penyetuju (Approver)',
  ACCOUNT_PAYABLE: 'Hutang Usaha (Account Payable)',
  WAREHOUSE: 'Gudang (Warehouse)',
  FINANCE: 'Keuangan (Finance)',
  AUDITOR: 'Auditor Internal',
  ADMIN: 'Administrator Sistem',
};

const ROLE_COLORS: Record<AppRole, string> = {
  REQUESTER: 'blue',
  APPROVER: 'purple',
  ACCOUNT_PAYABLE: 'cyan',
  WAREHOUSE: 'orange',
  FINANCE: 'green',
  AUDITOR: 'magenta',
  ADMIN: 'red',
};

export const RoleSwitcher: React.FC = () => {
  const { user, setActiveRole } = useAuthStore();

  const userRoles = user?.roles || ['REQUESTER'];
  const activeRole = user?.activeRole || 'REQUESTER';

  const menuItems = userRoles.map((role) => ({
    key: role,
    label: (
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Tag color={ROLE_COLORS[role]}>{role}</Tag>
          <Text>{ROLE_LABELS[role] || role}</Text>
        </Space>
        {role === activeRole && <CheckOutlined style={{ color: '#0052CC' }} />}
      </Space>
    ),
    onClick: () => setActiveRole(role),
  }));

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          padding: '4px 12px',
          borderRadius: 6,
          background: 'rgba(255, 255, 255, 0.15)',
          transition: 'background 0.2s',
        }}
      >
        <Avatar size="small" icon={<UserOutlined />} style={{ background: '#fff', color: '#0052CC' }} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
            {user?.fullName || 'Pengguna NusaProc'}
          </Text>
          <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 11 }}>
            {ROLE_LABELS[activeRole] || activeRole}
          </Text>
        </div>
        <DownOutlined style={{ color: '#fff', fontSize: 10, marginLeft: 4 }} />
      </div>
    </Dropdown>
  );
};
