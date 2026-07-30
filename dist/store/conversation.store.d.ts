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
import { IConversationStore, ConversationRecord } from '../types/index';
/**
 * In-memory conversation store implementation.
 *
 * Suitable for development and Phase 1 prototyping.
 * Data is lost on server restart. Replace with a database-backed
 * implementation for production use.
 */
export declare class MemoryConversationStore implements IConversationStore {
    /** Store records indexed by conversation ID */
    private records;
    /** Secondary index: phone number → conversation IDs */
    private phoneIndex;
    /** Secondary index: message ID → conversation ID */
    private messageIndex;
    /**
     * Store a conversation record.
     */
    store(record: ConversationRecord): Promise<void>;
    /**
     * Retrieve all records for a phone number.
     */
    getByPhone(phoneNumber: string): Promise<ConversationRecord[]>;
    /**
     * Retrieve a single record by conversation ID.
     */
    getByConversationId(conversationId: string): Promise<ConversationRecord | null>;
    /**
     * Retrieve a single record by WhatsApp message ID.
     */
    getByMessageId(messageId: string): Promise<ConversationRecord | null>;
    /**
     * Get recent conversation history for a phone number.
     * Returns the most recent N records, sorted by creation time.
     *
     * @param phoneNumber - Phone number to retrieve history for
     * @param limit - Maximum number of records to return (default: 10)
     */
    getRecentHistory(phoneNumber: string, limit?: number): Promise<ConversationRecord[]>;
}
//# sourceMappingURL=conversation.store.d.ts.map