/**
 * Android Foreground Service Manager
 * Prevents Android OS Doze Mode & Battery Optimization from terminating the persistent WSS socket
 */
export class AndroidForegroundServiceManager {
  private static readonly CHANNEL_ID = 'remote_print_agent_channel';
  private static readonly NOTIFICATION_ID = 8842;

  private nativeForegroundBridge: any;
  private isRunning = false;

  constructor(nativeForegroundBridge?: any) {
    this.nativeForegroundBridge =
      nativeForegroundBridge || (globalThis as any).RNForegroundService;
  }

  /**
   * Starts Android Foreground Service with ongoing persistent notification
   */
  public async startService(title = 'Remote Print Agent Running', body = 'Connected to Cloud Print Server (Active)'): Promise<void> {
    if (this.isRunning) {
      console.log('[ForegroundService] Service is already running.');
      return;
    }

    try {
      console.log('[ForegroundService] Starting Android Foreground Service...');

      if (this.nativeForegroundBridge) {
        // Configure Notification Channel
        await this.nativeForegroundBridge.createNotificationChannel({
          id: AndroidForegroundServiceManager.CHANNEL_ID,
          name: 'Remote Print Agent Service',
          description: 'Keeps persistent WebSocket connection active for remote print commands.',
          importance: 3, // IMPORTANCE_DEFAULT
        });

        // Start Ongoing Foreground Task
        await this.nativeForegroundBridge.start({
          id: AndroidForegroundServiceManager.NOTIFICATION_ID,
          title,
          message: body,
          icon: 'ic_launcher',
          button: 'Stop Service',
        });
      } else {
        console.warn('[ForegroundService] Native Foreground Bridge not available. Simulated Foreground Service active.');
      }

      this.isRunning = true;
      console.log('[ForegroundService] Foreground Service started successfully.');
    } catch (err) {
      console.error('[ForegroundService] Failed to start Foreground Service:', err);
      throw err;
    }
  }

  /**
   * Updates notification text (e.g., connection status changes)
   */
  public async updateNotification(title: string, body: string): Promise<void> {
    if (!this.isRunning) return;

    try {
      if (this.nativeForegroundBridge) {
        await this.nativeForegroundBridge.update({
          id: AndroidForegroundServiceManager.NOTIFICATION_ID,
          title,
          message: body,
        });
      } else {
        console.log(`[ForegroundService] Updated status: ${title} - ${body}`);
      }
    } catch (err) {
      console.error('[ForegroundService] Failed to update notification:', err);
    }
  }

  /**
   * Stops Foreground Service
   */
  public async stopService(): Promise<void> {
    if (!this.isRunning) return;

    try {
      if (this.nativeForegroundBridge) {
        await this.nativeForegroundBridge.stop();
      }
      this.isRunning = false;
      console.log('[ForegroundService] Foreground Service stopped.');
    } catch (err) {
      console.error('[ForegroundService] Failed to stop Foreground Service:', err);
    }
  }

  public isServiceActive(): boolean {
    return this.isRunning;
  }
}
