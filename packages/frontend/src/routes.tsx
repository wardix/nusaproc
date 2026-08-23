import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { PrCreateForm } from './features/pr/components/PrCreateForm';
import { TwoWayMatcherScreen } from './features/invoice/components/TwoWayMatcherScreen';

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/pr" replace />,
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
        path: 'audit',
        element: <div>Audit Trail & Kepatuhan</div>,
      },
    ],
  },
]);
