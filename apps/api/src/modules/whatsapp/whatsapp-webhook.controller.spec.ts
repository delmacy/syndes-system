import { UnauthorizedException } from '@nestjs/common';
import type { Pool } from 'pg';
import type { ChannelIngressService } from '../inbox/channel/channel-ingress.service';
import type { WhatsAppConfig } from './whatsapp.config';

jest.mock('../platform-core/platform-core.module', () => ({
  CONTROL_PLANE_DATABASE: 'CONTROL_PLANE_DATABASE',
}));

import { WhatsAppWebhookController } from './whatsapp-webhook.controller';

const config = {
  webhookToken: 'webhook-token',
} as WhatsAppConfig;

describe('WhatsAppWebhookController', () => {
  it('rejects missing or invalid adapter authentication before tenant lookup', async () => {
    const query = jest.fn();
    const controller = new WhatsAppWebhookController(
      config,
      { query } as unknown as Pool,
      {} as ChannelIngressService,
    );
    await expect(
      controller.event('00000000-0000-4000-8000-000000000001', undefined, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      controller.event(
        '00000000-0000-4000-8000-000000000001',
        'Bearer wrong',
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(query).not.toHaveBeenCalled();
  });

  it('resolves database server-side and passes only a trusted binding to Inbox', async () => {
    const query = jest
      .fn()
      .mockResolvedValue({ rows: [{ database_name: 'sdb_trusted' }] });
    const ingestTrustedBinding = jest
      .fn()
      .mockResolvedValue({ duplicate: false });
    const controller = new WhatsAppWebhookController(
      config,
      { query } as unknown as Pool,
      { ingestTrustedBinding } as unknown as ChannelIngressService,
    );
    const event = {
      externalMessageId: 'wa-1',
      senderExternalId: '5511@s.whatsapp.net',
      body: 'Olá',
    };
    await expect(
      controller.event(
        '00000000-0000-4000-8000-000000000001',
        'Bearer webhook-token',
        event,
      ),
    ).resolves.toEqual({ duplicate: false });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('provisioning_state'),
      ['00000000-0000-4000-8000-000000000001'],
    );
    expect(ingestTrustedBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseName: 'sdb_trusted',
        productChannel: 'whatsapp',
      }),
      event,
    );
  });
});
