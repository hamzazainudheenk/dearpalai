"use strict";
/**
 * Conversation Store
 *
 * Defines the IConversationStore interface and provides
 * an in-memory implementation (MemoryConversationStore).
 *
 * The interface allows easy replacement with persistent stores
 * (MongoConversationStore, PostgresConversationStore) in Phase 2
 * without modifying processors or controllers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryConversationStore = void 0;
const logger_1 = require("../utils/logger");
/**
 * In-memory conversation store implementation.
 *
 * Suitable for development and Phase 1 prototyping.
 * Data is lost on server restart. Replace with a database-backed
 * implementation for production use.
 */
class MemoryConversationStore {
    constructor() {
        /** Store records indexed by conversation ID */
        this.records = new Map();
        /** Secondary index: phone number → conversation IDs */
        this.phoneIndex = new Map();
        /** Secondary index: message ID → conversation ID */
        this.messageIndex = new Map();
    }
    /**
     * Store a conversation record.
     */
    async store(record) {
        // Store the record
        this.records.set(record.conversationId, record);
        // Update phone index
        const phoneRecords = this.phoneIndex.get(record.phoneNumber) || [];
        phoneRecords.push(record.conversationId);
        this.phoneIndex.set(record.phoneNumber, phoneRecords);
        // Update message index
        this.messageIndex.set(record.messageId, record.conversationId);
        logger_1.logger.debug('Stored conversation record', {
            conversationId: record.conversationId,
            messageId: record.messageId,
            phoneNumber: record.phoneNumber,
            messageType: record.messageType,
        });
    }
    /**
     * Retrieve all records for a phone number.
     */
    async getByPhone(phoneNumber) {
        const conversationIds = this.phoneIndex.get(phoneNumber) || [];
        return conversationIds
            .map((id) => this.records.get(id))
            .filter((record) => record !== undefined);
    }
    /**
     * Retrieve a single record by conversation ID.
     */
    async getByConversationId(conversationId) {
        return this.records.get(conversationId) || null;
    }
    /**
     * Retrieve a single record by WhatsApp message ID.
     */
    async getByMessageId(messageId) {
        const conversationId = this.messageIndex.get(messageId);
        if (!conversationId)
            return null;
        return this.records.get(conversationId) || null;
    }
    /**
     * Get recent conversation history for a phone number.
     * Returns the most recent N records, sorted by creation time.
     *
     * @param phoneNumber - Phone number to retrieve history for
     * @param limit - Maximum number of records to return (default: 10)
     */
    async getRecentHistory(phoneNumber, limit = 10) {
        const records = await this.getByPhone(phoneNumber);
        return records
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }
}
exports.MemoryConversationStore = MemoryConversationStore;
//# sourceMappingURL=conversation.store.js.map