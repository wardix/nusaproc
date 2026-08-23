export function getPaymentWorkflowCurrentStep(status: string): number {
  switch (status) {
    case 'DRAFT':
      return 0; // Maker stage
    case 'PENDING_CHECK':
    case 'REJECTED':
      return 1; // Checker stage
    case 'APPROVED_FOR_PAYMENT':
    case 'IN_PROGRESS':
      return 2; // Executor stage
    case 'PAID':
    case 'COMPLETED':
      return 3; // Finished
    default:
      return 0;
  }
}
