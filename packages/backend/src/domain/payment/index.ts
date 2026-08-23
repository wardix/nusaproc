export interface PaymentProposal {
  id: string;
  invoiceId: string;
  amount: number;
  proposerId: string;
  checkerId?: string;
  executorId?: string;
  status: 'PROPOSED' | 'CHECKED' | 'EXECUTED' | 'CANCELLED';
  idempotencyKey?: string;
}
