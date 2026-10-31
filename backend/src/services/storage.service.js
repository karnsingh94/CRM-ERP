import fs from 'fs';
import path from 'path';

/**
 * Storage Provider Abstract Interface
 */
export class StorageProvider {
  async saveFile(companyId, entityType, filename, buffer) {
    throw new Error('saveFile must be implemented');
  }

  async getFileStream(storageKey) {
    throw new Error('getFileStream must be implemented');
  }

  async deleteFile(storageKey) {
    throw new Error('deleteFile must be implemented');
  }

  async fileExists(storageKey) {
    throw new Error('fileExists must be implemented');
  }
}

/**
 * Local Disk Storage Provider with Tenant Folder Isolation
 */
export class LocalStorageProvider extends StorageProvider {
  constructor(baseDir = path.join(process.cwd(), 'uploads')) {
    super();
    this.baseDir = baseDir;
  }

  _resolveSafePath(storageKey) {
    const cleanKey = path.normalize(storageKey).replace(/^(\.\.[\/\\])+/, '');
    const absolute = path.resolve(this.baseDir, cleanKey);
    if (!absolute.startsWith(this.baseDir)) {
      throw new Error('Security Error: Path traversal detected.');
    }
    return absolute;
  }

  async saveFile(companyId, entityType, filename, buffer) {
    const safeCompany = String(companyId).replace(/[^a-zA-Z0-9_-]/g, '');
    const safeEntity = String(entityType).replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    const relativeDir = path.join('tenants', safeCompany, 'attachments', safeEntity);
    const targetDir = path.join(this.baseDir, relativeDir);

    fs.mkdirSync(targetDir, { recursive: true });

    const safeFilename = path.basename(filename);
    const relativeKey = path.join(relativeDir, safeFilename);
    const fullPath = path.join(targetDir, safeFilename);

    await fs.promises.writeFile(fullPath, buffer);
    return relativeKey.replace(/\\/g, '/');
  }

  async getFileStream(storageKey) {
    const fullPath = this._resolveSafePath(storageKey);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    return fs.createReadStream(fullPath);
  }

  async deleteFile(storageKey) {
    try {
      const fullPath = this._resolveSafePath(storageKey);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
      return true;
    } catch {
      return false;
    }
  }

  async fileExists(storageKey) {
    const fullPath = this._resolveSafePath(storageKey);
    return fs.existsSync(fullPath);
  }
}

// Default singleton provider: LocalStorageProvider
export const defaultStorageProvider = new LocalStorageProvider();

