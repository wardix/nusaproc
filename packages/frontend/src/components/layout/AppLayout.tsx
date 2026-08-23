import React from 'react';
import { Layout, Menu, Typography, Dropdown, Space, Avatar } from 'antd';
import { UserOutlined, ShoppingCartOutlined, FileDoneOutlined, DollarOutlined, AuditOutlined } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { APP_ROLES, type AppRole } from '@nusaproc/shared';

const { Header, Content, Sider } = Layout;
const { Text, Title } = Typography;

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setActiveRole } = useAuthStore();

  const menuItems = [
    { key: '/pr', icon: <ShoppingCartOutlined />, label: 'Purchase Request (PR)' },
    { key: '/po', icon: <FileDoneOutlined />, label: 'Purchase Order (PO)' },
    { key: '/invoices', icon: <DollarOutlined />, label: 'Invoices & 2-Way Match' },
    { key: '/audit', icon: <AuditOutlined />, label: 'Audit Trail' },
  ];

  const roleDropdownItems = APP_ROLES.map((role) => ({
    key: role,
    label: role,
    onClick: () => setActiveRole(role as AppRole),
  }));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: '#0052CC' }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>
          NusaProc
        </Title>
        <Space>
          <Dropdown menu={{ items: roleDropdownItems }} trigger={['click']}>
            <span style={{ color: '#fff', cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff' }}>{user?.activeRole || 'Pilih Peran'}</Text>
            </span>
          </Dropdown>
        </Space>
      </Header>
      <Layout>
        <Sider width={240} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content style={{ background: '#fff', padding: 24, margin: 0, minHeight: 280, borderRadius: 6 }}>
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};
