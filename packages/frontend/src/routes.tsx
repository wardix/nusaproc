import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ActionDashboard } from './features/dashboard/ActionDashboard';
import { PrListPage } from './features/pr/pages/PrListPage';
import { PrCreateForm } from './features/pr/components/PrCreateForm';
import { PoListPage } from './features/po/pages/PoListPage';
import { InvoiceListPage } from './features/invoice/pages/InvoiceListPage';
import { ReceiptListPage } from './features/receipt/pages/ReceiptListPage';
import { BastCreateForm } from './features/receipt/components/BastCreateForm';
import { NcrListPage } from './features/receipt/pages/NcrListPage';
import { PaymentListPage } from './features/payment/pages/PaymentListPage';
import { AuditLogPage } from './features/audit/pages/AuditLogPage';
import { LoginPage } from './features/auth/pages/LoginPage';
import { AdminUsersPage } from './features/admin/pages/AdminUsersPage';

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: <LoginPage />,
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
        element: <ActionDashboard />,
      },
      {
        path: 'pr',
        element: <PrListPage />,
      },
      {
        path: 'pr/create',
        element: <PrCreateForm />,
      },
      {
        path: 'po',
        element: <PoListPage />,
      },
      {
        path: 'vendors',
        element: <PoListPage />,
      },
      {
        path: 'receipts',
        element: <ReceiptListPage />,
      },
      {
        path: 'receipts/create',
        element: <BastCreateForm />,
      },
      {
        path: 'invoices',
        element: <InvoiceListPage />,
      },
      {
        path: 'ncr',
        element: <NcrListPage />,
      },
      {
        path: 'payments',
        element: <PaymentListPage />,
      },
      {
        path: 'audit',
        element: <AuditLogPage />,
      },
      {
        path: 'admin/users',
        element: <AdminUsersPage />,
      },
    ],
  },
];

export const router: ReturnType<typeof createBrowserRouter> =
  typeof document !== 'undefined'
    ? createBrowserRouter(routes)
    : (null as unknown as ReturnType<typeof createBrowserRouter>);
