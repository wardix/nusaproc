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

export const StatusTag: React.FC<StatusTagProps> = ({ status, category = 'generic', text, style }) => {
  const statusStr = typeof status === 'boolean' ? (status ? 'ACTIVE' : 'INACTIVE') : String(status).toUpperCase();

  // Boolean or Active / Inactive
  if (statusStr === 'ACTIVE' || statusStr === 'AKTIF' || status === true) {
    return (
      <Tag icon={<CheckCircleOutlined />} color="success" style={style}>
        {text || 'AKTIF'}
      </Tag>
    );
  }
  if (statusStr === 'INACTIVE' || statusStr === 'NONAKTIF' || status === false) {
    return (
      <Tag icon={<StopOutlined />} color="error" style={style}>
        {text || 'NONAKTIF'}
      </Tag>
    );
  }

  // PR status
  if (category === 'pr') {
    switch (statusStr) {
      case 'DRAFT':
        return <Tag color="default" style={style}>{text || 'DRAFT'}</Tag>;
      case 'SUBMITTED':
        return <Tag icon={<ClockCircleOutlined />} color="processing" style={style}>{text || 'SUBMITTED'}</Tag>;
      case 'APPROVED':
        return <Tag icon={<CheckCircleOutlined />} color="success" style={style}>{text || 'APPROVED'}</Tag>;
      case 'REJECTED':
        return <Tag icon={<CloseCircleOutlined />} color="error" style={style}>{text || 'REJECTED'}</Tag>;
      case 'CLOSED_PARTIAL':
        return <Tag color="warning" style={style}>{text || 'CLOSED PARTIAL'}</Tag>;
      default:
        return <Tag color="default" style={style}>{text || statusStr}</Tag>;
    }
  }

  // PO status
  if (category === 'po') {
    switch (statusStr) {
      case 'DRAFT':
        return <Tag color="default" style={style}>{text || 'DRAFT'}</Tag>;
      case 'APPROVED':
        return <Tag icon={<SyncOutlined spin />} color="processing" style={style}>{text || 'APPROVED'}</Tag>;
      case 'ISSUED':
        return <Tag icon={<CheckCircleOutlined />} color="success" style={style}>{text || 'ISSUED'}</Tag>;
      case 'AMENDED':
        return <Tag color="warning" style={style}>{text || 'AMENDED'}</Tag>;
      case 'CANCELLED':
        return <Tag icon={<CloseCircleOutlined />} color="error" style={style}>{text || 'CANCELLED'}</Tag>;
      default:
        return <Tag color="default" style={style}>{text || statusStr}</Tag>;
    }
  }

  // Invoice 2-Way Match status
  if (category === 'invoice') {
    switch (statusStr) {
      case 'MATCHED_OK':
        return <Tag icon={<CheckCircleOutlined />} color="success" style={style}>{text || 'MATCHED_OK'}</Tag>;
      case 'MATCHED_WITH_EXCEPTION':
        return <Tag icon={<AlertOutlined />} color="warning" style={style}>{text || 'MATCHED_WITH_EXCEPTION'}</Tag>;
      case 'EXCEPTION_OVERRIDDEN':
        return <Tag color="purple" style={style}>{text || 'EXCEPTION_OVERRIDDEN'}</Tag>;
      case 'UNMATCHED':
      default:
        return <Tag color="default" style={style}>{text || 'UNMATCHED'}</Tag>;
    }
  }

  // Payment Proposal status
  if (category === 'payment') {
    switch (statusStr) {
      case 'PROPOSED':
        return <Tag icon={<ClockCircleOutlined />} color="processing" style={style}>{text || 'PROPOSED'}</Tag>;
      case 'CHECKED':
        return <Tag color="warning" style={style}>{text || 'CHECKED'}</Tag>;
      case 'EXECUTED':
        return <Tag icon={<CheckCircleOutlined />} color="success" style={style}>{text || 'EXECUTED'}</Tag>;
      case 'REJECTED':
        return <Tag icon={<CloseCircleOutlined />} color="error" style={style}>{text || 'REJECTED'}</Tag>;
      default:
        return <Tag color="default" style={style}>{text || statusStr}</Tag>;
    }
  }

  // NCR status
  if (category === 'ncr') {
    if (statusStr === 'RESOLVED' || statusStr === 'TRUE') {
      return <Tag icon={<CheckCircleOutlined />} color="success" style={style}>{text || 'SELESAI / RESOLVED'}</Tag>;
    }
    return <Tag icon={<AlertOutlined />} color="error" style={style}>{text || 'OPEN / INVESTIGASI'}</Tag>;
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
