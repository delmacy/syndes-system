import type { TenantCrmDb } from '../../core-crm/tenant-crm.database';
import { CrmProblemException } from '../../core-crm/crm-problem-details';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import {
  loadVisibleConversation,
  toConversationResource,
} from './conversations.service';

const context: TenantContext = {
  actorId: 'a1',
  tenantId: 't1',
  databaseName: 'sdb_t1',
  role: 'tenant_member',
  customerScope: 'cpf',
};

function conversationRow() {
  return {
    conversation: {
      id: '11111111-1111-4111-8111-111111111111',
      personId: '22222222-2222-4222-8222-222222222222',
      organizationId: null,
      status: 'pending',
      assigneeActorId: null,
      channel: 'whatsapp',
      createdAt: new Date('2026-10-28T10:00:00.000Z'),
      updatedAt: new Date('2026-10-28T11:00:00.000Z'),
    },
    personName: 'Ana Souza',
    organizationName: null,
    preview: 'Olá, preciso de ajuda',
  };
}

function fakeDb(rows: unknown[]): TenantCrmDb {
  const builder = {
    from: () => builder,
    leftJoin: () => builder,
    where: () => builder,
    limit: () => Promise.resolve(rows),
  };
  return { select: () => builder } as unknown as TenantCrmDb;
}

describe('INBOX-02 conversation resource mapping', () => {
  it('maps a Person-linked conversation without duplicating CRM data', () => {
    const resource = toConversationResource(conversationRow());
    expect(resource).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      status: 'pending',
      channel: 'whatsapp',
      subject: 'Ana Souza',
      customerId: '22222222-2222-4222-8222-222222222222',
      personId: '22222222-2222-4222-8222-222222222222',
      organizationId: null,
      person: {
        id: '22222222-2222-4222-8222-222222222222',
        fullName: 'Ana Souza',
      },
      organization: null,
      preview: 'Olá, preciso de ajuda',
      unreadCount: 0,
      lastActivity: '2026-10-28T11:00:00.000Z',
      createdAt: '2026-10-28T10:00:00.000Z',
      updatedAt: '2026-10-28T11:00:00.000Z',
    });
  });

  it('uses the Organization name/subject when there is no Person', () => {
    const resource = toConversationResource({
      conversation: {
        ...conversationRow().conversation,
        personId: null,
        organizationId: '33333333-3333-4333-8333-333333333333',
        channel: 'unknown',
        assigneeActorId: '44444444-4444-4444-8444-444444444444',
      },
      personName: null,
      organizationName: 'Alfa Ltda',
      preview: null,
    });
    expect(resource).toMatchObject({
      subject: 'Alfa Ltda',
      customerId: '33333333-3333-4333-8333-333333333333',
      person: null,
      organization: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Alfa Ltda',
      },
      assigneeActorId: '44444444-4444-4444-8444-444444444444',
      preview: '',
      unreadCount: 0,
    });
  });

  it('truncates a long preview deterministically and never invents unread', () => {
    const resource = toConversationResource({
      ...conversationRow(),
      preview: 'x'.repeat(200),
    });
    expect(resource.preview.length).toBe(160);
    expect(resource.preview.endsWith('…')).toBe(true);
    expect(resource.unreadCount).toBe(0);
  });

  it('returns no subject/customer for an unlinked conversation', () => {
    const resource = toConversationResource({
      conversation: {
        ...conversationRow().conversation,
        personId: null,
        organizationId: null,
      },
      personName: null,
      organizationName: null,
      preview: null,
    });
    expect(resource.subject).toBeNull();
    expect(resource.customerId).toBeNull();
    expect(resource.person).toBeNull();
    expect(resource.organization).toBeNull();
  });
});

describe('INBOX-02 loadVisibleConversation', () => {
  it('returns the authorized conversation', async () => {
    const resource = await loadVisibleConversation(
      fakeDb([conversationRow()]),
      context,
      '11111111-1111-4111-8111-111111111111',
    );
    expect(resource.id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('maps an invisible/foreign id to the same not-found problem', async () => {
    await expect(
      loadVisibleConversation(
        fakeDb([]),
        context,
        '99999999-9999-4999-8999-999999999999',
      ),
    ).rejects.toMatchObject({
      response: { code: 'inbox_conversation_not_found' },
    });
    try {
      await loadVisibleConversation(
        fakeDb([]),
        context,
        '99999999-9999-4999-8999-999999999999',
      );
    } catch (error) {
      expect(error).toBeInstanceOf(CrmProblemException);
      expect((error as CrmProblemException).getStatus()).toBe(404);
    }
  });
});
