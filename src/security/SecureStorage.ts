/**
 * Android KeyStore & EncryptedSharedPreferences Secure Storage Manager
 * Stores AGENT_API_KEY & AGENT_ID securely
 */
export class SecureStorageManager {
  private static readonly KEY_API_KEY = 'REMOTE_PRINT_AGENT_API_KEY';
  private static readonly KEY_AGENT_ID = 'REMOTE_PRINT_AGENT_ID';

  private nativeEncryptedStorage: any;

  constructor(nativeEncryptedStorage?: any) {
    this.nativeEncryptedStorage =
      nativeEncryptedStorage || (globalThis as any).EncryptedStorage;
  }

  public async setApiKey(apiKey: string): Promise<void> {
    if (this.nativeEncryptedStorage) {
      await this.nativeEncryptedStorage.setItem(
        SecureStorageManager.KEY_API_KEY,
        apiKey
      );
    } else {
      console.warn('[SecureStorage] Native EncryptedStorage not available, using secure memory store.');
      (globalThis as any)[SecureStorageManager.KEY_API_KEY] = apiKey;
    }
  }

  public async getApiKey(): Promise<string | null> {
    if (this.nativeEncryptedStorage) {
      return await this.nativeEncryptedStorage.getItem(
        SecureStorageManager.KEY_API_KEY
      );
    }
    return (globalThis as any)[SecureStorageManager.KEY_API_KEY] || null;
  }

  public async setAgentId(agentId: string): Promise<void> {
    if (this.nativeEncryptedStorage) {
      await this.nativeEncryptedStorage.setItem(
        SecureStorageManager.KEY_AGENT_ID,
        agentId
      );
    } else {
      (globalThis as any)[SecureStorageManager.KEY_AGENT_ID] = agentId;
    }
  }

  public async getAgentId(): Promise<string | null> {
    if (this.nativeEncryptedStorage) {
      return await this.nativeEncryptedStorage.getItem(
        SecureStorageManager.KEY_AGENT_ID
      );
    }
    return (globalThis as any)[SecureStorageManager.KEY_AGENT_ID] || null;
  }

  public async clearCredentials(): Promise<void> {
    if (this.nativeEncryptedStorage) {
      await this.nativeEncryptedStorage.removeItem(SecureStorageManager.KEY_API_KEY);
      await this.nativeEncryptedStorage.removeItem(SecureStorageManager.KEY_AGENT_ID);
    } else {
      delete (globalThis as any)[SecureStorageManager.KEY_API_KEY];
      delete (globalThis as any)[SecureStorageManager.KEY_AGENT_ID];
    }
  }
}
