import React from 'react';
import { Tag } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  AlertOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { AppRole } from '@nusaproc/shared';

export const ROLE_COLORS: Record<AppRole, string> = {
  REQUESTER: 'blue',
  APPROVER: 'purple',
  ACCOUNT_PAYABLE: 'cyan',
  WAREHOUSE: 'orange',
  FINANCE: 'green',
  AUDITOR: 'magenta',
  ADMIN: 'red',
};

export const ROLE_LABELS: Record<AppRole, string> = {
  REQUESTER: 'Pengaju (Requester)',
  APPROVER: 'Penyetuju (Approver)',
  ACCOUNT_PAYABLE: 'Hutang Usaha (Account Payable)',
  WAREHOUSE: 'Gudang (Warehouse)',
  FINANCE: 'Keuangan (Finance)',
  AUDITOR: 'Auditor Internal',
  ADMIN: 'Administrator Sistem',
};

export interface RoleTagProps {
  role: AppRole;
  isTaxSpecialist?: boolean;
  style?: React.CSSProperties;
}

export const RoleTag: React.FC<RoleTagProps> = ({ role, isTaxSpecialist, style }) => {
  const color = ROLE_COLORS[role] || 'blue';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...style }}>
      <Tag color={color} style={{ margin: 0 }}>
        {role}
      </Tag>
      {isTaxSpecialist && (
        <Tag color="magenta" style={{ margin: 0, fontSize: 10 }}>
          PPN Specialist
        </Tag>
      )}
    </span>
  );
};

export type StatusCategory = 'pr' | 'po' | 'invoice' | 'payment' | 'ncr' | 'active' | 'generic';

export interface StatusTagProps {
  status: string | boolean;
  category?: StatusCategory;
  text?: string;
  style?: React.CSSProperties;
}

export const STATUS_LABELS: Record<string, string> = {
  // PR
  'PR:DRAFT': 'Draft',
  'PR:SUBMITTED': 'Diajukan',
  'PR:APPROVED': 'Disetujui',
  'PR:REJECTED': 'Ditolak',
  'PR:CLOSED_PARTIAL': 'Selesai Sebagian',
  // PO
  'PO:DRAFT': 'Draft',
  'PO:APPROVED': 'Disetujui',
  'PO:ISSUED': 'Diterbitkan (Issued)',
  'PO:AMENDED': 'Diamandemen',
  'PO:CANCELLED': 'Dibatalkan',
  // Invoice
  'INVOICE:MATCHED_OK': 'Cocok Sempurna (Matched)',
  'INVOICE:MATCHED_WITH_EXCEPTION': 'Selisih (Exception)',
  'INVOICE:EXCEPTION_OVERRIDDEN': 'Dilepas (Overridden)',
  'INVOICE:UNMATCHED': 'Belum Dicocokkan',
  // Payment
  'PAYMENT:PROPOSED': 'Diajukan (Maker)',
  'PAYMENT:CHECKED': 'Diperiksa (Checker)',
  'PAYMENT:EXECUTED': 'Dibayar (Executor)',
  'PAYMENT:REJECTED': 'Ditolak',
  // NCR
  'NCR:RESOLVED': 'Selesai (Resolved)',
  'NCR:OPEN': 'Dalam Investigasi (Open)',
  // Active
  'ACTIVE': 'Aktif',
  'INACTIVE': 'Nonaktif',
};

export const StatusTag: React.FC<StatusTagProps> = ({ status, category = 'generic', text, style }) => {
  const statusStr = typeof status === 'boolean' ? (status ? 'ACTIVE' : 'INACTIVE') : String(status).toUpperCase();

  // Boolean or Active / Inactive
  if (statusStr === 'ACTIVE' || statusStr === 'AKTIF' || status === true) {
    return (
      <Tag icon={<CheckCircleOutlined />} color="success" style={style}>
        {text || STATUS_LABELS['ACTIVE']}
      </Tag>
    );
  }
  if (statusStr === 'INACTIVE' || statusStr === 'NONAKTIF' || status === false) {
    return (
      <Tag icon={<StopOutlined />} color="error" style={style}>
        {text || STATUS_LABELS['INACTIVE']}
      </Tag>
    );
  }

  // PR status
  if (category === 'pr') {
    switch (statusStr) {
      case 'DRAFT':
        return <Tag color="default" style={style}>{text || STATUS_LABELS['PR:DRAFT']}</Tag>;
      case 'SUBMITTED':
        return <Tag icon={<ClockCircleOutlined />} color="processing" style={style}>{text || STATUS_LABELS['PR:SUBMITTED']}</Tag>;
      case 'APPROVED':
        return <Tag icon={<CheckCircleOutlined />} color="success" style={style}>{text || STATUS_LABELS['PR:APPROVED']}</Tag>;
      case 'REJECTED':
        return <Tag icon={<CloseCircleOutlined />} color="error" style={style}>{text || STATUS_LABELS['PR:REJECTED']}</Tag>;
      case 'CLOSED_PARTIAL':
        return <Tag color="warning" style={style}>{text || STATUS_LABELS['PR:CLOSED_PARTIAL']}</Tag>;
      default:
        return <Tag color="default" style={style}>{text || statusStr}</Tag>;
    }
  }

  // PO status
  if (category === 'po') {
    switch (statusStr) {
      case 'DRAFT':
        return <Tag color="default" style={style}>{text || STATUS_LABELS['PO:DRAFT']}</Tag>;
      case 'APPROVED':
        return <Tag icon={<SyncOutlined spin />} color="processing" style={style}>{text || STATUS_LABELS['PO:APPROVED']}</Tag>;
      case 'ISSUED':
        return <Tag icon={<CheckCircleOutlined />} color="success" style={style}>{text || STATUS_LABELS['PO:ISSUED']}</Tag>;
      case 'AMENDED':
        return <Tag color="warning" style={style}>{text || STATUS_LABELS['PO:AMENDED']}</Tag>;
      case 'CANCELLED':
        return <Tag icon={<CloseCircleOutlined />} color="error" style={style}>{text || STATUS_LABELS['PO:CANCELLED']}</Tag>;
      default:
        return <Tag color="default" style={style}>{text || statusStr}</Tag>;
    }
  }

  // Invoice 2-Way Match status
  if (category === 'invoice') {
    switch (statusStr) {
      case 'MATCHED_OK':
        return <Tag icon={<CheckCircleOutlined />} color="success" style={style}>{text || STATUS_LABELS['INVOICE:MATCHED_OK']}</Tag>;
      case 'MATCHED_WITH_EXCEPTION':
        return <Tag icon={<AlertOutlined />} color="warning" style={style}>{text || STATUS_LABELS['INVOICE:MATCHED_WITH_EXCEPTION']}</Tag>;
      case 'EXCEPTION_OVERRIDDEN':
        return <Tag color="purple" style={style}>{text || STATUS_LABELS['INVOICE:EXCEPTION_OVERRIDDEN']}</Tag>;
      case 'UNMATCHED':
      default:
        return <Tag color="default" style={style}>{text || STATUS_LABELS['INVOICE:UNMATCHED']}</Tag>;
    }
  }

  // Payment Proposal status
  if (category === 'payment') {
    switch (statusStr) {
      case 'PROPOSED':
        return <Tag icon={<ClockCircleOutlined />} color="processing" style={style}>{text || STATUS_LABELS['PAYMENT:PROPOSED']}</Tag>;
      case 'CHECKED':
        return <Tag color="warning" style={style}>{text || STATUS_LABELS['PAYMENT:CHECKED']}</Tag>;
      case 'EXECUTED':
        return <Tag icon={<CheckCircleOutlined />} color="success" style={style}>{text || STATUS_LABELS['PAYMENT:EXECUTED']}</Tag>;
      case 'REJECTED':
        return <Tag icon={<CloseCircleOutlined />} color="error" style={style}>{text || STATUS_LABELS['PAYMENT:REJECTED']}</Tag>;
      default:
        return <Tag color="default" style={style}>{text || statusStr}</Tag>;
    }
  }

  // NCR status
  if (category === 'ncr') {
    if (statusStr === 'RESOLVED' || statusStr === 'TRUE') {
      return <Tag icon={<CheckCircleOutlined />} color="success" style={style}>{text || STATUS_LABELS['NCR:RESOLVED']}</Tag>;
    }
    return <Tag icon={<AlertOutlined />} color="error" style={style}>{text || STATUS_LABELS['NCR:OPEN']}</Tag>;
  }

  // Default fallback mapper
  const fallbackColorMap: Record<string, string> = {
    APPROVED: 'success',
    ISSUED: 'success',
    EXECUTED: 'success',
    RESOLVED: 'success',
    SUBMITTED: 'processing',
    PROPOSED: 'processing',
    PENDING_CHECK: 'warning',
    CHECKED: 'warning',
    AMENDED: 'warning',
    MATCHED_WITH_EXCEPTION: 'warning',
    REJECTED: 'error',
    CANCELLED: 'error',
    BLACKLISTED: 'error',
    DRAFT: 'default',
    UNMATCHED: 'default',
  };

  return <Tag color={fallbackColorMap[statusStr] || 'default'} style={style}>{text || statusStr}</Tag>;
};

export default StatusTag;
