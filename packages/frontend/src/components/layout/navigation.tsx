import React from 'react';
import {
  ShoppingCartOutlined,
  CheckCircleOutlined,
  FileDoneOutlined,
  ShopOutlined,
  InboxOutlined,
  WarningOutlined,
  DollarOutlined,
  BankOutlined,
  AuditOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import type { AppRole } from '@nusaproc/shared';
import type { MenuProps } from 'antd';

export type MenuItem = Required<MenuProps>['items'][number];

export function getNavigationMenuItemsForRole(role: AppRole): MenuItem[] {
  const commonItems: MenuItem[] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
  ];

  switch (role) {
    case 'REQUESTER':
      return [
        ...commonItems,
        {
          key: '/pr',
          icon: <ShoppingCartOutlined />,
          label: 'Purchase Request (PR)',
        },
      ];

    case 'APPROVER':
      return [
        ...commonItems,
        {
          key: '/approvals/pr',
          icon: <CheckCircleOutlined />,
          label: 'Persetujuan PR',
        },
        {
          key: '/approvals/po',
          icon: <FileDoneOutlined />,
          label: 'Persetujuan PO',
        },
      ];

    case 'ACCOUNT_PAYABLE':
      return [
        ...commonItems,
        {
          key: '/invoices',
          icon: <DollarOutlined />,
          label: 'Invoice & 2-Way Match',
        },
        {
          key: '/payments',
          icon: <BankOutlined />,
          label: 'Pengajuan Pembayaran',
        },
      ];

    case 'WAREHOUSE':
      return [
        ...commonItems,
        {
          key: '/receipts',
          icon: <InboxOutlined />,
          label: 'Penerimaan Barang (BAST)',
        },
        {
          key: '/ncr',
          icon: <WarningOutlined />,
          label: 'Laporan Ketidaksesuaian (NCR)',
        },
      ];

    case 'FINANCE':
      return [
        ...commonItems,
        {
          key: '/invoices',
          icon: <DollarOutlined />,
          label: 'Invoice & 2-Way Match',
        },
        {
          key: '/payments',
          icon: <BankOutlined />,
          label: 'Pemeriksaan & Transfer Pembayaran',
        },
      ];

    case 'AUDITOR':
      return [
        ...commonItems,
        {
          key: '/audit',
          icon: <AuditOutlined />,
          label: 'Audit Trail & Integrity Sandbox',
        },
      ];

    case 'ADMIN':
    default:
      return [
        ...commonItems,
        {
          key: '/pr',
          icon: <ShoppingCartOutlined />,
          label: 'Purchase Request (PR)',
        },
        {
          key: '/po',
          icon: <FileDoneOutlined />,
          label: 'Purchase Order (PO)',
        },
        {
          key: '/vendors',
          icon: <ShopOutlined />,
          label: 'Vendor & Rekening',
        },
        {
          key: '/receipts',
          icon: <InboxOutlined />,
          label: 'Penerimaan (BAST)',
        },
        {
          key: '/ncr',
          icon: <WarningOutlined />,
          label: 'NCR',
        },
        {
          key: '/invoices',
          icon: <DollarOutlined />,
          label: 'Invoice & Match',
        },
        {
          key: '/payments',
          icon: <BankOutlined />,
          label: 'Pembayaran',
        },
        {
          key: '/audit',
          icon: <AuditOutlined />,
          label: 'Audit Trail',
        },
      ];
  }
}
