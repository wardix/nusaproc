import { SodConflictError } from './errors';

export interface TransactionActors {
  prRequesterId?: string;
  poAuthorId?: string;
  poApproverId?: string;
  goodsReceiverId?: string;
  paymentProposerId?: string;
  paymentCheckerId?: string;
  paymentExecutorId?: string;
}

export type ActionType =
  | 'APPROVE_PR'
  | 'APPROVE_PO'
  | 'RECEIVE_GOODS'
  | 'CHECK_PAYMENT'
  | 'EXECUTE_PAYMENT';

export { SodConflictError };

export function validateSodAction(
  currentActorId: string,
  action: ActionType,
  actors: TransactionActors
): void {
  switch (action) {
    case 'APPROVE_PR':
      if (actors.prRequesterId && actors.prRequesterId === currentActorId) {
        throw new SodConflictError(
          'Pelanggaran SoD: Requester tidak boleh menyetujui PR miliknya sendiri.',
          'R15_SELF_APPROVAL'
        );
      }
      break;

    case 'APPROVE_PO':
      if (actors.poAuthorId && actors.poAuthorId === currentActorId) {
        throw new SodConflictError(
          'Pelanggaran SoD: Pembuat PO tidak boleh menyetujui PO yang sama.',
          'R25_PO_AUTHOR_CANNOT_APPROVE'
        );
      }
      break;

    case 'RECEIVE_GOODS':
      if (actors.poAuthorId && actors.poAuthorId === currentActorId) {
        throw new SodConflictError(
          'Pelanggaran SoD: Pembuat PO tidak boleh mencatat penerimaan barang transaksi yang sama.',
          'R31_PO_AUTHOR_CANNOT_RECEIVE'
        );
      }
      if (actors.poApproverId && actors.poApproverId === currentActorId) {
        throw new SodConflictError(
          'Pelanggaran SoD: Penyetuju PO tidak boleh mencatat penerimaan barang transaksi yang sama.',
          'R31_PO_APPROVER_CANNOT_RECEIVE'
        );
      }
      break;

    case 'CHECK_PAYMENT':
      if (actors.paymentProposerId && actors.paymentProposerId === currentActorId) {
        throw new SodConflictError(
          'Pelanggaran SoD: Pengusul pembayaran (Maker) tidak boleh memeriksa usulannya sendiri (Checker).',
          'R42_MAKER_CANNOT_CHECK'
        );
      }
      break;

    case 'EXECUTE_PAYMENT':
      if (
        (actors.paymentProposerId && actors.paymentProposerId === currentActorId) ||
        (actors.paymentCheckerId && actors.paymentCheckerId === currentActorId)
      ) {
        throw new SodConflictError(
          'Pelanggaran SoD: Pelaksana transfer (Executor) wajib berbeda dari Maker dan Checker.',
          'R42_EXECUTOR_MUST_BE_DISTINCT'
        );
      }
      break;
  }
}
