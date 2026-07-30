"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockQueueService = void 0;
const logger_1 = require("../../utils/logger");
/**
 * Mock queue service — processes jobs synchronously (in-process).
 * Replace with actual queue implementation (BullMQ, SQS) in Phase 2.
 */
class MockQueueService {
    constructor() {
        this.jobCount = 0;
    }
    async enqueue(type, data) {
        this.jobCount++;
        const jobId = `mock-job-${this.jobCount}`;
        logger_1.logger.info('[Mock] Queue enqueue called', { jobId, type, data });
        return jobId;
    }
    process(handler) {
        logger_1.logger.info('[Mock] Queue process handler registered', { handler: handler.name });
    }
    async length() {
        return 0;
    }
}
exports.MockQueueService = MockQueueService;
//# sourceMappingURL=queue.service.js.map