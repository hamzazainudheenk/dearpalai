"use strict";
/**
 * Storage Service (Placeholder)
 *
 * Phase 2: Will provide an abstraction for file storage operations
 * (local filesystem, AWS S3, Google Cloud Storage, etc.) for
 * persisting audio files, transcriptions, and other artifacts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockStorageService = void 0;
const logger_1 = require("../../utils/logger");
/**
 * Mock storage service — logs operations but does not persist.
 * Replace with actual cloud storage client in Phase 2.
 */
class MockStorageService {
    async upload(filePath, key) {
        logger_1.logger.info('[Mock] Storage upload called', { filePath, key });
        return key;
    }
    async download(key, destinationPath) {
        logger_1.logger.info('[Mock] Storage download called', { key, destinationPath });
        return destinationPath;
    }
    async delete(key) {
        logger_1.logger.info('[Mock] Storage delete called', { key });
    }
    async exists(key) {
        logger_1.logger.info('[Mock] Storage exists called', { key });
        return false;
    }
}
exports.MockStorageService = MockStorageService;
//# sourceMappingURL=storage.service.js.map