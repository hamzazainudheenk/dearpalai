/**
 * Queue Service (Placeholder)
 *
 * Phase 2: Will provide an abstraction for message queues
 * (Bull, BullMQ, AWS SQS, RabbitMQ, etc.) to offload heavy
 * AI processing to background workers.
 *
 * This enables the webhook to respond instantly while
 * STT, RAG, and AI processing happen asynchronously.
 */

import { logger } from '@utils/logger';

/** Job payload structure */
export interface QueueJob<T = unknown> {
  id: string;
  type: string;
  data: T;
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
}

/** Interface for queue operations */
export interface IQueueService {
  /** Add a job to the queue */
  enqueue<T>(type: string, data: T): Promise<string>;
  /** Process jobs from the queue */
  process(handler: (job: QueueJob) => Promise<void>): void;
  /** Get the current queue length */
  length(): Promise<number>;
}

/**
 * Mock queue service — processes jobs synchronously (in-process).
 * Replace with actual queue implementation (BullMQ, SQS) in Phase 2.
 */
export class MockQueueService implements IQueueService {
  private jobCount = 0;

  async enqueue<T>(type: string, data: T): Promise<string> {
    this.jobCount++;
    const jobId = `mock-job-${this.jobCount}`;
    logger.info('[Mock] Queue enqueue called', { jobId, type, data });
    return jobId;
  }

  process(handler: (job: QueueJob) => Promise<void>): void {
    logger.info('[Mock] Queue process handler registered', { handler: handler.name });
  }

  async length(): Promise<number> {
    return 0;
  }
}
