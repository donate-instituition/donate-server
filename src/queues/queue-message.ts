import { randomUUID } from 'crypto';

export type QueueMessage<TPayload = unknown> = {
  attempt: number;
  id: string;
  idempotencyKey: string;
  payload: TPayload;
  publishedAt: string;
  type: string;
};

export function createQueueMessage<TPayload>({
  idempotencyKey,
  payload,
  type,
}: {
  idempotencyKey?: string;
  payload: TPayload;
  type: string;
}): QueueMessage<TPayload> {
  return {
    attempt: 1,
    id: randomUUID(),
    idempotencyKey: idempotencyKey || randomUUID(),
    payload,
    publishedAt: new Date().toISOString(),
    type,
  };
}
