import type { AppRole } from '../types/roles';

export interface DemoPersona {
  id: string;
  email: string;
  fullName: string;
  employeeId: string;
  divisionId: string;
  branchId: string;
  role: AppRole;
  jobTitle: string;
  avatarColor: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    email: 'budi.santoso@nusanet.net.id',
    fullName: 'Budi Santoso',
    employeeId: 'EMP-REQ-001',
    divisionId: 'DIV-IT',
    branchId: 'HQ_MEDAN',
    role: 'REQUESTER',
    jobTitle: 'IT Infrastructure Engineer',
    avatarColor: '#1890ff',
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    email: 'siti.aminah@nusanet.net.id',
    fullName: 'Siti Aminah',
    employeeId: 'EMP-APP-001',
    divisionId: 'DIV-IT',
    branchId: 'HQ_MEDAN',
    role: 'APPROVER',
    jobTitle: 'IT Department Head',
    avatarColor: '#52c41a',
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    email: 'dewi.lestari@nusanet.net.id',
    fullName: 'Dewi Lestari',
    employeeId: 'EMP-AP-001',
    divisionId: 'DIV-FIN',
    branchId: 'HQ_MEDAN',
    role: 'ACCOUNT_PAYABLE',
    jobTitle: 'AP Staff (Maker)',
    avatarColor: '#fa8c16',
  },
  {
    id: '10000000-0000-0000-0000-000000000004',
    email: 'hendra.wijaya@nusanet.net.id',
    fullName: 'Hendra Wijaya',
    employeeId: 'EMP-AP-002',
    divisionId: 'DIV-FIN',
    branchId: 'HQ_MEDAN',
    role: 'ACCOUNT_PAYABLE',
    jobTitle: 'Head of AP (Checker)',
    avatarColor: '#faad14',
  },
  {
    id: '10000000-0000-0000-0000-000000000005',
    email: 'joko.susilo@nusanet.net.id',
    fullName: 'Joko Susilo',
    employeeId: 'EMP-WH-001',
    divisionId: 'DIV-OPS',
    branchId: 'HQ_MEDAN',
    role: 'WAREHOUSE',
    jobTitle: 'Warehouse & Logistics Lead',
    avatarColor: '#722ed1',
  },
  {
    id: '10000000-0000-0000-0000-000000000006',
    email: 'rina.kartika@nusanet.net.id',
    fullName: 'Rina Kartika',
    employeeId: 'EMP-FIN-001',
    divisionId: 'DIV-FIN',
    branchId: 'HQ_MEDAN',
    role: 'FINANCE',
    jobTitle: 'Finance Treasury Executor',
    avatarColor: '#13c2c2',
  },
  {
    id: '10000000-0000-0000-0000-000000000007',
    email: 'agus.setiawan@nusanet.net.id',
    fullName: 'Agus Setiawan',
    employeeId: 'EMP-AUD-001',
    divisionId: 'DIV-AUDIT',
    branchId: 'HQ_MEDAN',
    role: 'AUDITOR',
    jobTitle: 'Senior Internal Auditor',
    avatarColor: '#eb2f96',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'admin@nusanet.net.id',
    fullName: 'Administrator Darurat (Fallback)',
    employeeId: 'EMP-ADMIN-FALLBACK',
    divisionId: 'IT_SECURITY',
    branchId: 'HQ_MEDAN',
    role: 'ADMIN',
    jobTitle: 'System Administrator',
    avatarColor: '#f5222d',
  },
];
