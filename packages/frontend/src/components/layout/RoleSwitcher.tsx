import React from 'react';
import { Dropdown, Space, Avatar, Tag, Typography, type MenuProps } from 'antd';
import { UserOutlined, DownOutlined, CheckOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { user, setActiveRole, logout } = useAuthStore();

  const userRoles = user?.roles || ['REQUESTER'];
  const activeRole = user?.activeRole || 'REQUESTER';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleMenuItems: MenuProps['items'] = userRoles.map((role) => ({
    key: `role-${role}`,
    label: (
      <Space style={{ width: '100%', justifyContent: 'space-between', minWidth: 220 }}>
        <Space>
          <Tag color={ROLE_COLORS[role]}>{role}</Tag>
          <Text style={{ fontSize: 13 }}>{ROLE_LABELS[role] || role}</Text>
        </Space>
        {role === activeRole && <CheckOutlined style={{ color: '#0052CC' }} />}
      </Space>
    ),
    onClick: () => setActiveRole(role),
  }));

  const menuItems: MenuProps['items'] = [
    {
      key: 'user-info',
      disabled: true,
      label: (
        <div style={{ padding: '4px 0' }}>
          <Text strong style={{ color: '#262626', display: 'block' }}>
            {user?.fullName || 'Pengguna NusaProc'}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {user?.email || 'user@nusanet.net.id'}
          </Text>
        </div>
      ),
    },
    {
      type: 'divider',
    },
    ...roleMenuItems,
    {
      type: 'divider',
    },
    {
      key: 'logout',
      danger: true,
      icon: <LogoutOutlined />,
      label: 'Keluar dari Sistem',
      onClick: handleLogout,
    },
  ];

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
