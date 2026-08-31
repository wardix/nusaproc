import React, { useState } from 'react';
import { Layout, Menu, Typography, Grid, theme, Drawer, Button } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { RoleSwitcher } from './RoleSwitcher';
import { getNavigationMenuItemsForRole } from './navigation';
import { FeedbackWidget } from '../feedback/FeedbackWidget';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { AuditorWatermark } from '../security/AuditorWatermark';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

export const AppLayout: React.FC = () => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const { user, isAuthenticated } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // If user is not authenticated and not present in store, redirect to /login
  if (!isAuthenticated && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const activeRole = user?.activeRole || 'REQUESTER';
  const menuItems = getNavigationMenuItemsForRole(activeRole);

  const isMobile = !screens.md;

  const getSelectedMenuKeys = (pathname: string): string[] => {
    // 1. Exact match in current role's menu items
    if (menuItems.some((item) => item?.key === pathname)) {
      return [pathname];
    }
    // 2. Hierarchical prefix matches for sub-routes
    if (pathname.startsWith('/approvals/pr')) return ['/approvals/pr'];
    if (pathname.startsWith('/approvals/po')) return ['/approvals/po'];
    if (pathname.startsWith('/pr')) return ['/pr'];
    if (pathname.startsWith('/po')) return ['/po'];
    if (pathname.startsWith('/vendors')) return ['/vendors'];
    if (pathname.startsWith('/receipts')) return ['/receipts'];
    if (pathname.startsWith('/invoices')) return ['/invoices'];
    if (pathname.startsWith('/ncr')) return ['/ncr'];
    if (pathname.startsWith('/payments')) return ['/payments'];
    if (pathname.startsWith('/audit')) return ['/audit'];
    if (pathname.startsWith('/admin/users')) return ['/admin/users'];
    if (pathname.startsWith('/admin/organization')) return ['/admin/organization'];
    if (pathname.startsWith('/admin/feedback')) return ['/admin/feedback'];

    return [pathname];
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0 12px' : '0 20px',
          background: token.colorPrimary,
          height: 64,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isMobile && (
            <Button
              type="text"
              aria-label="Buka Menu Navigasi"
              icon={<MenuOutlined style={{ color: '#fff', fontSize: 18 }} />}
              onClick={() => setMobileDrawerOpen(true)}
              style={{ padding: 4 }}
            />
          )}
          <Title level={4} style={{ color: '#fff', margin: 0, letterSpacing: -0.5, fontSize: isMobile ? 18 : 20 }}>
            {import.meta.env.VITE_APP_NAME || 'NusaProc'}
          </Title>
        </div>
        <RoleSwitcher />
      </Header>
      <Layout>
        {!isMobile && (
          <Sider
            width={240}
            collapsible
            collapsed={collapsed}
            onCollapse={(value) => setCollapsed(value)}
            theme="light"
            breakpoint="lg"
            collapsedWidth={80}
            style={{
              overflow: 'auto',
              height: 'calc(100vh - 64px)',
              position: 'sticky',
              top: 64,
              left: 0,
              borderRight: '1px solid #f0f0f0',
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={getSelectedMenuKeys(location.pathname)}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
              style={{ borderRight: 0, paddingTop: 8 }}
            />
          </Sider>
        )}
        <Layout style={{ padding: isMobile ? '12px' : '24px' }}>
          <Content
            style={{
              background: '#fff',
              padding: isMobile ? 16 : 24,
              margin: 0,
              minHeight: 280,
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <AuditorWatermark>
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </AuditorWatermark>
          </Content>
        </Layout>
      </Layout>

      {/* Drawer Menu Navigasi Mobile (R56, Resolusi Ponsel >= 360px) */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Title level={4} style={{ margin: 0, color: token.colorPrimary }}>
              {import.meta.env.VITE_APP_NAME || 'NusaProc'}
            </Title>
          </div>
        }
        placement="left"
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        bodyStyle={{ padding: 0 }}
        width={280}
      >
        <Menu
          mode="inline"
          selectedKeys={getSelectedMenuKeys(location.pathname)}
          items={menuItems}
          onClick={({ key }) => {
            navigate(key);
            setMobileDrawerOpen(false);
          }}
          style={{ borderRight: 0, paddingTop: 8 }}
        />
      </Drawer>

      <FeedbackWidget />
    </Layout>
  );
};

export default AppLayout;
