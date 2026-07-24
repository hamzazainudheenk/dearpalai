/**
 * Storage Service (Placeholder)
 *
 * Phase 2: Will provide an abstraction for file storage operations
 * (local filesystem, AWS S3, Google Cloud Storage, etc.) for
 * persisting audio files, transcriptions, and other artifacts.
 */

import { logger } from '@utils/logger';

/** Interface for file storage operations */
export interface IStorageService {
  /** Upload a file and return the storage key */
  upload(filePath: string, key: string): Promise<string>;
  /** Download a file to a local path */
  download(key: string, destinationPath: string): Promise<string>;
  /** Delete a file by storage key */
  delete(key: string): Promise<void>;
  /** Check if a file exists */
  exists(key: string): Promise<boolean>;
}

/**
 * Mock storage service — logs operations but does not persist.
 * Replace with actual cloud storage client in Phase 2.
 */
export class MockStorageService implements IStorageService {
  async upload(filePath: string, key: string): Promise<string> {
    logger.info('[Mock] Storage upload called', { filePath, key });
    return key;
  }

  async download(key: string, destinationPath: string): Promise<string> {
    logger.info('[Mock] Storage download called', { key, destinationPath });
    return destinationPath;
  }

  async delete(key: string): Promise<void> {
    logger.info('[Mock] Storage delete called', { key });
  }

  async exists(key: string): Promise<boolean> {
    logger.info('[Mock] Storage exists called', { key });
    return false;
  }
}
