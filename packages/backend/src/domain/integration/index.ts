export interface OutboxEvent {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  retryCount: number;
  createdAt: string;
}
