import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import type { ChannelIngressService } from '../inbox/channel/channel-ingress.service';
import type { WhatsAppConfig } from './whatsapp.config';
import type { TenantContext } from '../platform-core/identity/identity.contracts';
import type { WhatsAppConnectionService } from './whatsapp-connection.service';

jest.mock('../platform-core/platform-core.module', () => ({
  CONTROL_PLANE_DATABASE: 'CONTROL_PLANE_DATABASE',
}));

import { WhatsAppWebhookController } from './whatsapp-webhook.controller';

const config = {
  webhookToken: 'webhook-token',
} as WhatsAppConfig;

const TENANT_ID = '00000000-0000-4000-8000-000000000001';
const DATABASE_NAME = 'sdb_trusted';

function controllerWith(overrides: {
  query?: ReturnType<typeof jest.fn>;
  connection?: unknown;
  ingestTrustedBinding?: ReturnType<typeof jest.fn>;
}) {
  const query = overrides.query ?? jest.fn();
  const connection = overrides.connection ?? {
    serviceEnabled: true,
    suspensionReason: null,
  };
  const ingestTrustedBinding =
    overrides.ingestTrustedBinding ??
    jest.fn().mockResolvedValue({ duplicate: false });

  const connectionsGet = jest.fn().mockResolvedValue(connection);
  const connections = {
    get: connectionsGet,
  } as unknown as WhatsAppConnectionService;

  const controller = new WhatsAppWebhookController(
    config,
    { query } as unknown as Pool,
    { ingestTrustedBinding } as unknown as ChannelIngressService,
    connections,
  );
  return {
    controller,
    query,
    connectionsGet,
    ingestTrustedBinding,
  };
}

function contextFor(databaseName: string): TenantContext {
  return {
    actorId: '00000000-0000-4000-8000-0000000000cc',
    tenantId: TENANT_ID,
    databaseName,
    role: 'tenant_admin',
    customerScope: 'both',
  };
}

describe('WhatsAppWebhookController', () => {
  it('rejects missing or invalid adapter authentication before tenant lookup', async () => {
    const { query, controller } = controllerWith({});
    await expect(
      controller.event(TENANT_ID, undefined, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      controller.event(TENANT_ID, 'Bearer wrong', {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(query).not.toHaveBeenCalled();
  });

  it('resolves database server-side and passes only a trusted binding to Inbox', async () => {
    const query = jest
      .fn()
      .mockResolvedValue({ rows: [{ database_name: DATABASE_NAME }] });
    const ingestTrustedBinding = jest
      .fn()
      .mockResolvedValue({ duplicate: false });
    const {
      controller,
      connectionsGet,
      ingestTrustedBinding: itb,
    } = controllerWith({ query, ingestTrustedBinding });
    const event = {
      externalMessageId: 'wa-1',
      senderExternalId: '5511@s.whatsapp.net',
      body: 'Olá',
    };
    await expect(
      controller.event(TENANT_ID, 'Bearer webhook-token', event),
    ).resolves.toEqual({ duplicate: false });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('provisioning_state'),
      [TENANT_ID],
    );
    expect(connectionsGet).toHaveBeenCalledWith(contextFor(DATABASE_NAME));
    expect(itb).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseName: DATABASE_NAME,
        productChannel: 'whatsapp',
      }),
      event,
    );
  });

  it('rejects an unknown tenant binding without delivering to Inbox', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const ingestTrustedBinding = jest.fn();
    const {
      controller,
      connectionsGet,
      ingestTrustedBinding: itb,
    } = controllerWith({ query, ingestTrustedBinding });
    await expect(
      controller.event(TENANT_ID, 'Bearer webhook-token', {}),
    ).rejects.toMatchObject({
      response: { code: 'whatsapp_tenant_binding_not_found' },
    });
    expect(connectionsGet).not.toHaveBeenCalled();
    expect(itb).not.toHaveBeenCalled();
  });

  it('does not persist or deliver when the tenant is suspended for delinquency', async () => {
    const query = jest
      .fn()
      .mockResolvedValue({ rows: [{ database_name: DATABASE_NAME }] });
    const ingestTrustedBinding = jest.fn();
    const {
      controller,
      connectionsGet,
      ingestTrustedBinding: itb,
    } = controllerWith({
      query,
      connection: { serviceEnabled: false, suspensionReason: 'delinquency' },
      ingestTrustedBinding,
    });
    await expect(
      controller.event(TENANT_ID, 'Bearer webhook-token', {
        externalMessageId: 'wa-2',
        senderExternalId: '5511@s.whatsapp.net',
        body: 'Oi',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(connectionsGet).toHaveBeenCalledWith(contextFor(DATABASE_NAME));
    expect(itb).not.toHaveBeenCalled();
  });

  it('routes tenant through control plane and never from the payload', async () => {
    const query = jest
      .fn()
      .mockResolvedValue({ rows: [{ database_name: DATABASE_NAME }] });
    const ingestTrustedBinding = jest
      .fn()
      .mockResolvedValue({ duplicate: false });
    const { controller, ingestTrustedBinding: itb } = controllerWith({
      query,
      ingestTrustedBinding,
    });
    // Payload carries no tenant/database; even a forged tenant id in the body
    // is ignored — routing comes from the URL param + control plane.
    await controller.event(TENANT_ID, 'Bearer webhook-token', {
      externalMessageId: 'wa-3',
      senderExternalId: '5511@s.whatsapp.net',
      body: 'X',
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM tenants WHERE id = $1'),
      [TENANT_ID],
    );
    expect(itb).toHaveBeenCalledWith(
      expect.objectContaining({ databaseName: DATABASE_NAME }),
      expect.anything(),
    );
  });

  it('delivers through the trusted InboxChannelRegistry binding record', async () => {
    const query = jest
      .fn()
      .mockResolvedValue({ rows: [{ database_name: DATABASE_NAME }] });
    const ingestTrustedBinding = jest
      .fn()
      .mockResolvedValue({ duplicate: false });
    const { controller, ingestTrustedBinding: itb } = controllerWith({
      query,
      ingestTrustedBinding,
    });
    await controller.event(TENANT_ID, 'Bearer webhook-token', {
      externalMessageId: 'wa-4',
      senderExternalId: '5511@s.whatsapp.net',
      body: 'X',
    });
    const [binding] = itb.mock.calls[0] as [unknown];
    expect((binding as { productChannel: string }).productChannel).toBe(
      'whatsapp',
    );
    expect((binding as { databaseName: string }).databaseName).toBe(
      DATABASE_NAME,
    );
    expect((binding as { tenantId: string }).tenantId).toBe(TENANT_ID);
    expect((binding as { bindingToken: string }).bindingToken).toBe(
      `whatsmeow:${TENANT_ID}`,
    );
  });
});
