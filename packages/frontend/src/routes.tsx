import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Spin } from 'antd';

const PageLoader: React.FC = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 360, width: '100%' }}>
    <Spin size="large" />
  </div>
);

const withSuspense = (Component: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

const LoginPage = lazy(() => import('./features/auth/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const ActionDashboard = lazy(() => import('./features/dashboard/ActionDashboard').then(m => ({ default: m.ActionDashboard })));
const PrListPage = lazy(() => import('./features/pr/pages/PrListPage').then(m => ({ default: m.PrListPage })));
const PrCreateForm = lazy(() => import('./features/pr/components/PrCreateForm').then(m => ({ default: m.PrCreateForm })));
const PoListPage = lazy(() => import('./features/po/pages/PoListPage').then(m => ({ default: m.PoListPage })));
const PoCreateForm = lazy(() => import('./features/po/components/PoCreateForm').then(m => ({ default: m.PoCreateForm })));
const InvoiceListPage = lazy(() => import('./features/invoice/pages/InvoiceListPage').then(m => ({ default: m.InvoiceListPage })));
const ReceiptListPage = lazy(() => import('./features/receipt/pages/ReceiptListPage').then(m => ({ default: m.ReceiptListPage })));
const BastCreateForm = lazy(() => import('./features/receipt/components/BastCreateForm').then(m => ({ default: m.BastCreateForm })));
const NcrListPage = lazy(() => import('./features/receipt/pages/NcrListPage').then(m => ({ default: m.NcrListPage })));
const PaymentListPage = lazy(() => import('./features/payment/pages/PaymentListPage').then(m => ({ default: m.PaymentListPage })));
const AuditLogPage = lazy(() => import('./features/audit/pages/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const AdminUsersPage = lazy(() => import('./features/admin/pages/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminOrganizationPage = lazy(() => import('./features/admin/pages/AdminOrganizationPage').then(m => ({ default: m.AdminOrganizationPage })));
const AdminFeedbackPage = lazy(() => import('./features/admin/pages/AdminFeedbackPage').then(m => ({ default: m.AdminFeedbackPage })));
const VendorListPage = lazy(() => import('./features/vendor/pages/VendorListPage').then(m => ({ default: m.VendorListPage })));

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: withSuspense(LoginPage),
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: withSuspense(ActionDashboard),
      },
      {
        path: 'approvals/pr',
        element: withSuspense(PrListPage),
      },
      {
        path: 'approvals/po',
        element: withSuspense(PoListPage),
      },
      {
        path: 'pr',
        element: withSuspense(PrListPage),
      },
      {
        path: 'pr/create',
        element: withSuspense(PrCreateForm),
      },
      {
        path: 'po',
        element: withSuspense(PoListPage),
      },
      {
        path: 'po/create',
        element: withSuspense(PoCreateForm),
      },
      {
        path: 'vendors',
        element: withSuspense(VendorListPage),
      },
      {
        path: 'receipts',
        element: withSuspense(ReceiptListPage),
      },
      {
        path: 'receipts/create',
        element: withSuspense(BastCreateForm),
      },
      {
        path: 'invoices',
        element: withSuspense(InvoiceListPage),
      },
      {
        path: 'ncr',
        element: withSuspense(NcrListPage),
      },
      {
        path: 'payments',
        element: withSuspense(PaymentListPage),
      },
      {
        path: 'audit',
        element: withSuspense(AuditLogPage),
      },
      {
        path: 'admin/users',
        element: withSuspense(AdminUsersPage),
      },
      {
        path: 'admin/organization',
        element: withSuspense(AdminOrganizationPage),
      },
      {
        path: 'admin/feedback',
        element: withSuspense(AdminFeedbackPage),
      },
    ],
  },
];

export const router: ReturnType<typeof createBrowserRouter> =
  typeof document !== 'undefined'
    ? createBrowserRouter(routes)
    : (null as unknown as ReturnType<typeof createBrowserRouter>);
