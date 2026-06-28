import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, ClientConfig } from 'pg';
import { LogicalReplicationService, PgoutputPlugin, Pgoutput } from 'pg-logical-replication';
import { RealtimeV1Gateway } from './realtime-v1.gateway';
import { WalChangePayload, WalChangeType } from './interfaces/wal-payload.interface';

const SCHEMA_PREFIX = 'proj_';

@Injectable()
export class WalListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WalListenerService.name);

  private replicationService: LogicalReplicationService | null = null;
  private adminClient: Client | null = null;
  private isRunning = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly publicationName: string;
  private readonly slotName: string;
  private readonly dbConfig: ClientConfig;

  constructor(
    @Inject(forwardRef(() => RealtimeV1Gateway))
    private readonly gateway: RealtimeV1Gateway,
    private readonly configService: ConfigService,
  ) {
    this.publicationName = this.configService.get<string>(
      'REALTIME_PUBLICATION',
      'vrixobase_realtime',
    );
    this.slotName = this.configService.get<string>(
      'REALTIME_SLOT',
      'vrixobase_cdc_slot',
    );

    const dbUrl = this.configService.get<string>('DATABASE_URL', '');
    this.dbConfig = {
      connectionString: dbUrl.split('?')[0],
      statement_timeout: 30000,
    };
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('WAL Listener Service initializing...');

    try {
      await this.setupInfrastructure();
      await this.startReplication();
    } catch (err) {
      this.logger.error(
        `Failed to initialize WAL listener: ${(err as Error).message}`,
      );
      this.logger.log('Will retry in 10 seconds...');
      this.scheduleReconnect(10000);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.isRunning = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    await this.stopReplication();
    await this.closeAdminClient();
  }

  private async setupInfrastructure(): Promise<void> {
    this.adminClient = new Client(this.dbConfig);
    await this.adminClient.connect();
    this.logger.log('Admin PG client connected for WAL setup');

    const pubExists = await this.publicationExists();
    if (!pubExists) {
      this.logger.log(`Creating publication "${this.publicationName}"...`);
      await this.adminClient.query(
        `CREATE PUBLICATION ${this.quoteIdent(this.publicationName)} FOR ALL TABLES`,
      );
      this.logger.log(`Publication "${this.publicationName}" created`);
    } else {
      this.logger.log(`Publication "${this.publicationName}" already exists`);
    }

    const slotExists = await this.replicationSlotExists();
    if (!slotExists) {
      this.logger.log(`Creating replication slot "${this.slotName}"...`);
      await this.adminClient.query(
        `SELECT pg_create_logical_replication_slot($1, $2)`,
        [this.slotName, 'pgoutput'],
      );
      this.logger.log(`Replication slot "${this.slotName}" created`);
    } else {
      this.logger.log(`Replication slot "${this.slotName}" already exists`);
    }

    const walLevel = await this.adminClient.query(`SHOW wal_level`);
    if (walLevel.rows[0]?.wal_level !== 'logical') {
      this.logger.warn(
        `wal_level="${walLevel.rows[0]?.wal_level}", expected "logical". Set wal_level=logical in postgresql.conf.`,
      );
    }

    this.logger.log('WAL infrastructure ready');
  }

  private async startReplication(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    const options: Pgoutput.Options = {
      protoVersion: 1,
      publicationNames: [this.publicationName],
    };

    const plugin = new PgoutputPlugin(options);

    this.replicationService = new LogicalReplicationService(
      this.dbConfig,
      {
        acknowledge: {
          auto: true,
          timeoutSeconds: 10,
        },
        flowControl: {
          enabled: true,
        },
      },
    );

    this.replicationService.on('error', (err: Error) => {
      this.logger.error(`Replication stream error: ${err.message}`);
      this.isRunning = false;
      this.scheduleReconnect(5000);
    });

    this.replicationService.on('data', async (_lsn: string, log: any) => {
      try {
        await this.handleReplicationMessage(log);
      } catch (err) {
        this.logger.error(
          `Failed to process message: ${(err as Error).message}`,
        );
      }
    });

    const startLsn = this.configService.get<string>('REALTIME_START_LSN', '');
    if (startLsn && startLsn !== '0/0') {
      await this.replicationService.subscribe(plugin, this.slotName, startLsn);
    } else {
      await this.replicationService.subscribe(plugin, this.slotName);
    }

    this.logger.log(
      `WAL replication started on slot "${this.slotName}" for publication "${this.publicationName}"`,
    );
  }

  private async handleReplicationMessage(message: Pgoutput.Message): Promise<void> {
    if (message.tag === 'relation') {
      return;
    }

    if (message.tag === 'begin' || message.tag === 'commit') {
      return;
    }

    if (message.tag === 'origin' || message.tag === 'type' || message.tag === 'message') {
      return;
    }

    if (message.tag === 'truncate') {
      for (const rel of message.relations) {
        await this.processChange('DELETE', rel, null, null);
      }
      return;
    }

    if (message.tag === 'insert') {
      await this.processChange(
        'INSERT',
        message.relation,
        null,
        message.new,
      );
      return;
    }

    if (message.tag === 'update') {
      await this.processChange(
        'UPDATE',
        message.relation,
        message.old || null,
        message.new,
      );
      return;
    }

    if (message.tag === 'delete') {
      await this.processChange(
        'DELETE',
        message.relation,
        message.old || null,
        null,
      );
      return;
    }
  }

  private async processChange(
    eventType: 'INSERT' | 'UPDATE' | 'DELETE',
    relation: Pgoutput.MessageRelation,
    oldData: Record<string, any> | null,
    newData: Record<string, any> | null,
  ): Promise<void> {
    const { schema, name: table } = relation;

    if (!schema.startsWith(SCHEMA_PREFIX)) {
      return;
    }

    const projectId = schema.slice(SCHEMA_PREFIX.length);
    if (!projectId || projectId.length === 0) return;

    const columnNames = relation.columns.map((c: Pgoutput.RelationColumn) => c.name);

    const payload: WalChangePayload = {
      projectId,
      tableName: table,
      schema,
      eventType: WalChangeType[eventType],
      commitTimestamp: new Date(),
      newData: newData ? this.sanitizeRecord(newData) : null,
      oldData: oldData ? this.sanitizeRecord(oldData) : null,
      columns: columnNames,
    };

    this.gateway.broadcastToProject(projectId, table, payload);
  }

  private sanitizeRecord(record: Record<string, any>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(record)) {
      if (val instanceof Buffer) {
        result[key] = val.toString('base64');
      } else if (val instanceof Date) {
        result[key] = val.toISOString();
      } else if (typeof val === 'bigint') {
        result[key] = Number(val);
      } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        try {
          result[key] = JSON.parse(JSON.stringify(val));
        } catch {
          result[key] = String(val);
        }
      } else {
        result[key] = val;
      }
    }
    return result;
  }

  private async publicationExists(): Promise<boolean> {
    const result = await this.adminClient!.query(
      `SELECT 1 FROM pg_publication WHERE pubname = $1`,
      [this.publicationName],
    );
    return result.rows.length > 0;
  }

  private async replicationSlotExists(): Promise<boolean> {
    const result = await this.adminClient!.query(
      `SELECT 1 FROM pg_replication_slots WHERE slot_name = $1`,
      [this.slotName],
    );
    return result.rows.length > 0;
  }

  private async stopReplication(): Promise<void> {
    if (this.replicationService) {
      try {
        await this.replicationService.stop();
      } catch (err) {
        this.logger.warn(`Error stopping replication: ${(err as Error).message}`);
      }
      try {
        await this.replicationService.destroy();
      } catch (err) {
        this.logger.warn(`Error destroying replication service: ${(err as Error).message}`);
      }
      this.replicationService = null;
    }
  }

  private async closeAdminClient(): Promise<void> {
    if (this.adminClient) {
      try {
        await this.adminClient.end();
      } catch (err) {
        this.logger.warn(`Error closing admin client: ${(err as Error).message}`);
      }
      this.adminClient = null;
    }
  }

  private scheduleReconnect(delayMs: number): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = setTimeout(async () => {
      this.logger.log('Attempting WAL listener reconnection...');
      try {
        await this.setupInfrastructure();
        await this.startReplication();
      } catch (err) {
        this.logger.error(
          `Reconnection failed: ${(err as Error).message}, retrying in 30s`,
        );
        this.scheduleReconnect(30000);
      }
    }, delayMs);
  }

  private quoteIdent(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }
}
