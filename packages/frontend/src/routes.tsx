import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ActionDashboard } from './features/dashboard/ActionDashboard';
import { PrCreateForm } from './features/pr/components/PrCreateForm';
import { TwoWayMatcherScreen } from './features/invoice/components/TwoWayMatcherScreen';

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
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
        element: <PrCreateForm />,
      },
      {
        path: 'invoices',
        element: (
          <TwoWayMatcherScreen
            poData={{ poNumber: 'PO-2026-0001', totalAmount: 10000000 }}
            invoiceData={{
              invoiceNumber: 'INV-2026-99',
              subtotalAmount: 10000000,
              variance: 0,
              variancePct: 0,
            }}
          />
        ),
      },
      {
        path: 'po',
        element: <div>Daftar Surat Pesanan (PO)</div>,
      },
      {
        path: 'vendors',
        element: <div>Manajemen Vendor & Rekening Bank</div>,
      },
      {
        path: 'receipts',
        element: <div>Penerimaan Barang & BAST</div>,
      },
      {
        path: 'ncr',
        element: <div>Laporan Ketidaksesuaian (NCR)</div>,
      },
      {
        path: 'payments',
        element: <div>Proposal & Eksekusi Pembayaran</div>,
      },
      {
        path: 'audit',
        element: <div>Audit Trail & Kepatuhan</div>,
      },
    ],
  },
]);
