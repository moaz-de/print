import { AgentConfig } from './types';
import { SecureStorageManager } from './security/SecureStorage';
import { AndroidForegroundServiceManager } from './service/ForegroundService';
import { PrinterDiscoveryService } from './discovery/PrinterDiscovery';
import { AgentWebSocketClient } from './websocket/WebSocketClient';
import { PrintJobDispatcher } from './dispatcher/PrintDispatcher';

export class AndroidPrintAgent {
  private config: AgentConfig;
  private secureStorage: SecureStorageManager;
  private foregroundService: AndroidForegroundServiceManager;
  private discoveryService: PrinterDiscoveryService;
  private wsClient: AgentWebSocketClient;
  private dispatcher: PrintJobDispatcher;

  constructor(config: AgentConfig) {
    this.config = config;
    this.secureStorage = new SecureStorageManager();
    this.foregroundService = new AndroidForegroundServiceManager();
    this.discoveryService = new PrinterDiscoveryService(config.agent_id);
    this.wsClient = new AgentWebSocketClient(config);
    this.dispatcher = new PrintJobDispatcher(config.agent_id, this.wsClient);

    // Setup WSS Dispatch Handler
    this.wsClient.setPrintJobHandler(async (job) => {
      await this.dispatcher.handleJobDispatch(job);
    });

    // Setup WSS OnConnect Callback (Trigger Printer Discovery)
    this.wsClient.setConnectCallback(async () => {
      await this.publishPrinterDiscovery();
    });
  }

  /**
   * Initializes Agent, stores credentials securely, starts Foreground Service,
   * and opens persistent WSS socket.
   */
  public async start(): Promise<void> {
    console.log('=====================================================');
    console.log(' Starting Android Remote Print Management Agent');
    console.log(` Agent ID: ${this.config.agent_id}`);
    console.log(` Cloud Server: ${this.config.cloud_url}`);
    console.log('=====================================================');

    // 1. Save Credentials in Encrypted Storage / KeyStore
    await this.secureStorage.setApiKey(this.config.api_key);
    await this.secureStorage.setAgentId(this.config.agent_id);

    // 2. Start Android Foreground Service (Prevents OS Sleep / Battery Optimization Kill)
    await this.foregroundService.startService(
      'Remote Print Agent Active',
      `Agent ID: ${this.config.agent_id} | WSS Connected`
    );

    // 3. Initial Local Printer Discovery Scan (BT, USB, Wi-Fi)
    const printers = await this.discoveryService.discoverAllPrinters();
    this.dispatcher.updateKnownPrinters(printers);

    // 4. Initiate Persistent Outbound WSS Connection to Cloud
    this.wsClient.connect();
  }

  /**
   * Triggers a printer discovery scan and transmits result to Cloud Server
   */
  public async publishPrinterDiscovery(): Promise<void> {
    try {
      console.log('[AndroidPrintAgent] Publishing printer discovery state to Cloud Server...');
      const discoveryPayload = await this.discoveryService.buildDiscoveryPayload('online');
      this.dispatcher.updateKnownPrinters(discoveryPayload.printers);
      this.wsClient.send(discoveryPayload);
      console.log('[AndroidPrintAgent] Printer discovery state published successfully.');
    } catch (err) {
      console.error('[AndroidPrintAgent] Error publishing printer discovery:', err);
    }
  }

  /**
   * Gracefully shuts down agent connection and service
   */
  public async stop(): Promise<void> {
    console.log('[AndroidPrintAgent] Stopping Android Remote Print Agent...');
    this.wsClient.disconnect();
    await this.foregroundService.stopService();
    console.log('[AndroidPrintAgent] Agent stopped gracefully.');
  }
}

// Example Usage / Startup Script
if (require.main === module) {
  const agentConfig: AgentConfig = {
    cloud_url: process.env.CLOUD_WSS_URL || 'wss://print.manaf.store/ws/agent',
    agent_id: process.env.AGENT_ID || 'ANDROID_TERMINAL_01',
    api_key: process.env.AGENT_API_KEY || 'secret_agent_api_key_7700',
  };

  const agent = new AndroidPrintAgent(agentConfig);
  agent.start().catch((err) => {
    console.error('Fatal Error starting Android Print Agent:', err);
  });
}
