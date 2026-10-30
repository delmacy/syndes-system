/**
 * WA-05 — Integração E2E do WhatsApp com fake provider (ambiente privado/Tailscale).
 *
 * Escopo: configuração → pareamento/sessão → inbound → Inbox → outbound → reconnect,
 * com regressões de duplicate/reconnect/billing suspension/unauthorized/cross-tenant,
 * observabilidade mínima e evidência do fluxo ponta a ponta.
 *
 * Instancia os serviços do módulo WhatsApp diretamente com mocks de infraestrutura
 * (tenant DB, control plane, audit), evitando carregar o AppModule completo que
 * importa dependências ESM (jose) incompatíveis com o runner de testes Jest/CJS.
 */
import type { Pool } from 'pg';

// Mock dos guards do Nest (importam jose/ESM, incompatível com Jest CJS).
jest.mock('../platform-core/identity/identity-auth.guard', () => ({
  IdentityAuthGuard: class {
    canActivate = () => true;
  },
}));
jest.mock('../platform-core/identity/tenant-context.guard', () => ({
  TenantContextGuard: class {
    canActivate = () => true;
  },
}));
jest.mock('../platform-core/platform-core.module', () => ({
  CONTROL_PLANE_DATABASE: 'CONTROL_PLANE_DATABASE',
}));

import { WhatsAppConnectionService } from './whatsapp-connection.service';
import { WhatsAppSessionService } from './whatsapp-session.service';
import { WhatsAppOutboundAdapter } from './whatsapp-outbound.adapter';
import { WhatsAppOutboundQueue } from './whatsapp-outbound.queue';
import { WhatsAppRateLimiter } from './whatsapp-rate-limiter';
import { FakeWhatsAppProvider } from './fake-whatsapp.provider';
import { WhatsAppAuditWriter } from './whatsapp-audit';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import type { TenantContext } from '../platform-core/identity/identity.contracts';
import { TenantCrmDatabase } from '../core-crm/tenant-crm.database';
import type { TenantCrmDb } from '../core-crm/tenant-crm.database';
import type { WhatsAppConfig } from './whatsapp.config';
import { ChannelAdapterRegistry } from '../inbox/channel/channel-adapter-registry';
import { ChannelIngressService } from '../inbox/channel/channel-ingress.service';
import { InboxChannelRegistry } from '../inbox/channel/inbox-channel-registry';

const TENANT_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const TENANT_B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const DB_A = 'sdb_tenant_a';
const DB_B = 'sdb_tenant_b';
const ACTOR_ID = '00000000-0000-4000-8000-0000000000cc';

function contextFor(tenantId: string, databaseName: string): TenantContext {
  return {
    actorId: ACTOR_ID,
    tenantId,
    databaseName,
    role: 'tenant_admin',
    customerScope: 'both',
  };
}

/** Cria um mock Drizzle stateful com múltiplas tabelas (Map<tableObject, rows[]>). */
function makeDrizzleMock() {
  const tables = new Map<object, unknown[]>();
  let currentTable: object | null = null;
  /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn(function (this: unknown, _table: unknown) {
      currentTable = _table as object;
      if (!tables.has(currentTable)) tables.set(currentTable, []);
      return chain;
    }),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockImplementation(function (n: number) {
      const rows = tables.get(currentTable ?? {}) ?? [];
      return Promise.resolve(rows.slice(-n));
    }),
    insert: jest.fn(function (this: unknown, _table: unknown) {
      currentTable = _table as object;
      if (!tables.has(currentTable)) tables.set(currentTable, []);
      return chain;
    }),
    values: jest.fn(function (this: unknown, v: Record<string, unknown>) {
      const rows = tables.get(currentTable ?? {}) ?? [];
      const row = {
        ...v,
        id: '00000000-0000-0000-0000-000000000000',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rows.push(row);
      return chain;
    }),
    onConflictDoUpdate: jest.fn().mockReturnThis(),
    returning: jest.fn().mockImplementation(function () {
      const rows = tables.get(currentTable ?? {}) ?? [];
      return Promise.resolve(rows.slice(-1));
    }),
    update: jest.fn().mockReturnThis(),
    set: jest.fn(function (this: unknown, v: Record<string, unknown>) {
      const rows = tables.get(currentTable ?? {}) ?? [];
      if (rows.length)
        rows[rows.length - 1] = {
          ...rows[rows.length - 1],
          ...v,
          updatedAt: new Date(),
        };
      return chain;
    }),
    execute: jest.fn().mockResolvedValue({ rows: [] }),
    transaction: jest.fn(async (work: (db: typeof chain) => Promise<unknown>) =>
      work(chain),
    ),
  };
  chain.update.set = chain.set;
  chain.set.where = jest.fn().mockReturnThis();
  chain.set.returning = chain.returning;
  chain.where.returning = chain.returning;
  return {
    chain,
    getRows: (table: string) => [...(tables.get(table) ?? [])],
    reset: () => {
      tables.clear();
      currentTable = null;
    },
  };
  /* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
}

function makeTenantDb() {
  const dbs = new Map<string, ReturnType<typeof makeDrizzleMock>>();
  return {
    withTenant: jest.fn<
      [TenantContext, (db: TenantCrmDb) => Promise<unknown>],
      Promise<unknown>
      // eslint-disable-next-line @typescript-eslint/require-await
    >(async (_ctx, work) => {
      const key = `${_ctx.databaseName}`;
      if (!dbs.has(key)) dbs.set(key, makeDrizzleMock());
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return work(dbs.get(key)!.chain as unknown);
    }),
  };
}

function makeControlPlanePool() {
  const tenants = new Map<string, string>([
    [TENANT_A, DB_A],
    [TENANT_B, DB_B],
  ]);
  return {
    query: jest.fn((_sqlText: string, params: unknown[]) => {
      const tenantId = params[0];
      const databaseName = tenants.get(tenantId as string);
      if (!databaseName) return { rows: [] };
      return { rows: [{ database_name: databaseName }] };
    }),
  } as unknown as Pool;
}

function buildConfig(overrides: Partial<WhatsAppConfig> = {}): WhatsAppConfig {
  return {
    enabled: true,
    bindHost: '127.0.0.1',
    port: 18083,
    webhookPath: '/api/v1/whatsapp/webhook',
    provider: 'fake',
    whatsmeowUrl: null,
    whatsmeowToken: null,
    webhookToken: 'webhook-secret-token',
    requestTimeoutMs: 10_000,
    publicBaseUrl: null,
    maxConnectionsPerTenant: 1,
    ...overrides,
  };
}

function buildHarness(configOverride: Partial<WhatsAppConfig> = {}) {
  const config = buildConfig(configOverride);
  const tenantDb = makeTenantDb();
  const controlPlane = makeControlPlanePool();

  const connections = new WhatsAppConnectionService(
    tenantDb as unknown as TenantCrmDatabase,
  );
  const fake = new FakeWhatsAppProvider();
  const sessions = new WhatsAppSessionService(
    config,
    connections,
    fake,
    {} as never, // whatsmeow não usado com provider=fake
  );
  const rateLimiter = new WhatsAppRateLimiter();
  const queue = new WhatsAppOutboundQueue(sessions, rateLimiter);
  const adapter = new WhatsAppOutboundAdapter({} as never, queue, config);
  const registry = new ChannelAdapterRegistry();
  if (config.enabled) registry.registerProductionAdapter('whatsapp', adapter);
  const channelRegistry = new InboxChannelRegistry();

  const auditRecordSpy = jest
    .fn<
      (
        ctx: TenantContext,
        action: string,
        result: 'success' | 'denied' | 'failure',
      ) => Promise<void>
    >()
    .mockResolvedValue(undefined);
  const audit = { record: auditRecordSpy } as unknown as WhatsAppAuditWriter;

  const ingressAudit = {
    channel: jest.fn().mockResolvedValue(undefined),
  } as never;
  const ingress = new ChannelIngressService(
    tenantDb as unknown as TenantCrmDatabase,
    channelRegistry,
    ingressAudit,
  );

  const webhookController = new WhatsAppWebhookController(
    config,
    controlPlane,
    {
      ingestTrustedBinding: ingress.ingestTrustedBinding.bind(ingress),
    } as never,
    connections,
  );

  const controller = new WhatsAppController(connections, sessions, audit);

  return {
    config,
    tenantDb,
    controlPlane,
    connections,
    sessions,
    fake,
    queue,
    adapter,
    registry,
    channelRegistry,
    audit,
    auditRecordSpy,
    ingress,
    webhookController,
    controller,
  };
}

describe('WA-05 WhatsApp E2E integration (fake provider, private Tailscale)', () => {
  describe('fluxo ponta a ponta: configuração → sessão → inbound → Inbox → outbound → reconnect', () => {
    it('executar jornada completa para o tenant A', async () => {
      const { sessions, channelRegistry, webhookController, queue } =
        buildHarness();
      const ctxA = contextFor(TENANT_A, DB_A);

      // 1) Configuração: startPairing gera código de pareamento (não exposto em log)
      const pairing = await sessions.startPairing(ctxA);
      expect(pairing.pairingCode).toMatch(/^fake-/);

      // 2) Sessão: connect conecta o provider fake
      const connection = await sessions.connect(ctxA);
      expect(connection.status).toBe('connected');
      expect(connection.phoneExternalId).toBe(`fake:${TENANT_A}`);
      expect(connection.authorized).toBe(true);

      // 3) Inbound: webhook autenticado entrega no Inbox via Control Plane lookup
      const binding = channelRegistry.registerServerSide({
        bindingToken: `whatsmeow:${TENANT_A}`,
        tenantId: TENANT_A,
        databaseName: DB_A,
        productChannel: 'whatsapp',
      });
      expect(binding.bindingToken).toBe(`whatsmeow:${TENANT_A}`);

      const inboundEvent = {
        externalMessageId: 'wa-msg-1',
        senderExternalId: '5511999999999@s.whatsapp.net',
        body: 'Olá, preciso de suporte',
      };
      const ingressResult = await webhookController.event(
        TENANT_A,
        'Bearer webhook-secret-token',
        inboundEvent,
      );
      expect(ingressResult.duplicate).toBe(false);
      expect(ingressResult.conversationId).toBeDefined();
      expect(ingressResult.messageId).toBeDefined();

      // Replay do mesmo event -> duplicate, mesmo messageId
      const replay = await webhookController.event(
        TENANT_A,
        'Bearer webhook-secret-token',
        inboundEvent,
      );
      expect(replay.duplicate).toBe(true);
      expect(replay.messageId).toBe(ingressResult.messageId);

      // 4) Outbound: resposta do Inbox despachada pelo adapter fake via fila
      const outbound = await queue.dispatch(
        ctxA,
        '5511999999999@s.whatsapp.net',
        'Estou aqui para ajudar.',
      );
      expect(outbound.deliveryStatus).toBe('dispatched');
      expect(outbound.externalId).toMatch(/^fake-/);

      // 5) Reconnect: segura a sessão existente e reconecta sem novo pareamento
      const reconnected = await sessions.reconnect(ctxA);
      expect(reconnected.status).toBe('connected');
      expect(reconnected.phoneExternalId).toBe(`fake:${TENANT_A}`);
    });

    it('isola tenant A de tenant B (zero cross-tenant)', async () => {
      const { sessions, connections, channelRegistry, webhookController } =
        buildHarness();
      const ctxA = contextFor(TENANT_A, DB_A);
      const ctxB = contextFor(TENANT_B, DB_B);

      await sessions.startPairing(ctxA);
      await sessions.connect(ctxA);

      channelRegistry.registerServerSide({
        bindingToken: `whatsmeow:${TENANT_A}`,
        tenantId: TENANT_A,
        databaseName: DB_A,
        productChannel: 'whatsapp',
      });
      await webhookController.event(TENANT_A, 'Bearer webhook-secret-token', {
        externalMessageId: 'wa-msg-a',
        senderExternalId: '5511999999999@s.whatsapp.net',
        body: 'msg A',
      });

      // Tenant B não deve enxergar a conexão de A
      const connB = await connections.get(ctxB);
      expect(connB).toBeNull();

      channelRegistry.registerServerSide({
        bindingToken: `whatsmeow:${TENANT_B}`,
        tenantId: TENANT_B,
        databaseName: DB_B,
        productChannel: 'whatsapp',
      });
      await webhookController.event(TENANT_B, 'Bearer webhook-secret-token', {
        externalMessageId: 'wa-msg-b',
        senderExternalId: '5511999999999@s.whatsapp.net',
        body: 'msg B',
      });

      const connA = await connections.get(ctxA);
      expect(connA?.status).toBe('connected');
    });
  });

  describe('regressão: suspend/payment (billing)', () => {
    it('suspende por delinquência e reativa preservando a sessão', async () => {
      const { sessions } = buildHarness();
      const ctxA = contextFor(TENANT_A, DB_A);

      await sessions.startPairing(ctxA);
      await sessions.connect(ctxA);

      const suspended = await sessions.suspendForDelinquency(ctxA);
      expect(suspended.status).toBe('suspended');
      expect(suspended.serviceEnabled).toBe(false);
      expect(suspended.suspensionReason).toBe('delinquency');
      expect(suspended.phoneExternalId).toBe(`fake:${TENANT_A}`); // sessão preservada

      // Enviar bloqueado enquanto suspenso
      await expect(
        sessions.sendText(ctxA, '5511999999999@s.whatsapp.net', 'x'),
      ).rejects.toThrow('whatsapp_suspended');
      await expect(sessions.reconnect(ctxA)).rejects.toThrow(
        'whatsapp_suspended',
      );

      // Reativação após pagamento: reconecta sem novo pareamento
      const reactivated = await sessions.reactivateAfterPayment(ctxA);
      expect(reactivated.status).toBe('connected');
      expect(reactivated.serviceEnabled).toBe(true);
      expect(reactivated.suspensionReason).toBe(null);
    });

    it('webhook rejeita inbound de tenant suspenso por delinquência', async () => {
      const { sessions, webhookController, channelRegistry } = buildHarness();
      const ctxA = contextFor(TENANT_A, DB_A);

      await sessions.startPairing(ctxA);
      await sessions.connect(ctxA);
      await sessions.suspendForDelinquency(ctxA);

      channelRegistry.registerServerSide({
        bindingToken: `whatsmeow:${TENANT_A}`,
        tenantId: TENANT_A,
        databaseName: DB_A,
        productChannel: 'whatsapp',
      });
      await expect(
        webhookController.event(TENANT_A, 'Bearer webhook-secret-token', {
          externalMessageId: 'wa-suspended',
          senderExternalId: '5511999999999@s.whatsapp.net',
          body: 'não deve entrar',
        }),
      ).rejects.toThrow();
    });
  });

  describe('regressão: autorização e tenant não selecionável pelo cliente', () => {
    it('requer tenant_admin no controller e não aceita tenant escolhido pelo cliente', async () => {
      const { controller } = buildHarness();
      const memberContext: TenantContext = {
        ...contextFor(TENANT_A, DB_A),
        role: 'tenant_member',
      };
      const req = {
        identityContext: {
          tenant: memberContext,
        },
        headers: { authorization: 'Bearer mock' },
      };
      await expect(controller.pairing(req)).rejects.toThrow(
        'Only tenant_admin may manage the WhatsApp connection.',
      );
    });

    it('webhook autentica com Bearer token antes de qualquer lookup de tenant', async () => {
      const { webhookController } = buildHarness();
      await expect(
        webhookController.event(TENANT_A, undefined, {}),
      ).rejects.toThrow();
      await expect(
        webhookController.event(TENANT_A, 'Bearer wrong-token', {}),
      ).rejects.toThrow();
    });

    it('webhook resolve database pelo control plane, nunca pelo payload', async () => {
      const { webhookController, channelRegistry, controlPlane } =
        buildHarness();
      const querySpy = jest.spyOn(controlPlane, 'query');
      channelRegistry.registerServerSide({
        bindingToken: `whatsmeow:${TENANT_A}`,
        tenantId: TENANT_A,
        databaseName: DB_A,
        productChannel: 'whatsapp',
      });
      await webhookController.event(TENANT_A, 'Bearer webhook-secret-token', {
        externalMessageId: 'wa-routing',
        senderExternalId: '5511999999999@s.whatsapp.net',
        body: 'x',
      });
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining('FROM tenants WHERE id = $1'),
        [TENANT_A],
      );
    });
  });

  describe('observabilidade: auditoria e logs sanitizados', () => {
    it('audita eventos de conexão sem vazar segredos', async () => {
      const { controller, auditRecordSpy } = buildHarness();
      const req = {
        identityContext: {
          tenant: {
            actorId: ACTOR_ID,
            tenantId: TENANT_A,
            databaseName: DB_A,
            role: 'tenant_admin',
            customerScope: 'both',
          },
        },
        headers: { authorization: 'Bearer mock' },
      } as unknown as {
        identityContext: { tenant: TenantContext };
        headers: { authorization: string };
      };

      await controller.pairing(req);
      await controller.connect(req);

      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      const connectedCall = auditRecordSpy.mock.calls.find(
        (c) => c[1] === 'whatsapp.connection.connected',
      );
      expect(connectedCall).toBeDefined();
      expect(connectedCall?.[0]).toMatchObject({ tenantId: TENANT_A });
      expect(connectedCall?.[2]).toBe('success');

      const calls = auditRecordSpy.mock.calls.map((c) => JSON.stringify(c));
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      expect(calls.join('|')).not.toContain('fake-');
      expect(calls.join('|')).not.toContain('sessionSecret');
    });
  });

  describe('adapter de produção WhatsApp registrado no registry', () => {
    it('exibe productionProvider=true e adapterId=whatsmeow', () => {
      const { adapter, registry } = buildHarness();
      expect(adapter.adapterId).toBe('whatsmeow');
      expect(adapter.productionProvider).toBe(true);
      const registered = registry.adapterFor('whatsapp');
      expect(registered).toBe(adapter);
    });
  });
});
