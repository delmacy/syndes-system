import { getTableColumns } from 'drizzle-orm';

import { crmTags, crmTagAssignments } from './tags/tags.schema';
import { crmNotes } from './notes/notes.schema';
import {
  crmTimelineEvents,
  TIMELINE_EVENT_KINDS,
} from './timeline/timeline.schema';
import { crmChannelIdentities } from './channel-identities/channel-identities.schema';

const FROZEN_TIMELINE_EVENT_KINDS = [
  'person.created',
  'person.updated',
  'person.archived',
  'organization.created',
  'organization.updated',
  'organization.archived',
  'relationship.created',
  'relationship.removed',
  'tag.attached',
  'tag.detached',
  'note.created',
] as const;

describe('Core CRM supporting schema (CRM-06)', () => {
  it('freezes exactly the approved CRM-06 timeline event kinds', () => {
    expect(TIMELINE_EVENT_KINDS).toEqual(FROZEN_TIMELINE_EVENT_KINDS);
  });

  it('declares the tags table with the reviewed columns', () => {
    expect(Object.keys(getTableColumns(crmTags))).toEqual([
      'id',
      'name',
      'color',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('declares the tag assignments table with the reviewed columns', () => {
    expect(Object.keys(getTableColumns(crmTagAssignments))).toEqual([
      'id',
      'tagId',
      'personId',
      'organizationId',
      'createdAt',
    ]);
  });

  it('declares the notes table with the reviewed columns', () => {
    expect(Object.keys(getTableColumns(crmNotes))).toEqual([
      'id',
      'personId',
      'organizationId',
      'body',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('declares the timeline events table with the reviewed columns', () => {
    expect(Object.keys(getTableColumns(crmTimelineEvents))).toEqual([
      'id',
      'eventKind',
      'actorId',
      'personId',
      'organizationId',
      'tagId',
      'noteId',
      'occurredAt',
    ]);
  });

  it('declares the channel identities table with the reviewed columns', () => {
    expect(Object.keys(getTableColumns(crmChannelIdentities))).toEqual([
      'id',
      'personId',
      'channel',
      'externalId',
      'externalUsername',
      'pushName',
      'businessName',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('has no tenant_id column in any supporting table (isolation by database routing)', () => {
    for (const table of [
      crmTags,
      crmTagAssignments,
      crmNotes,
      crmTimelineEvents,
      crmChannelIdentities,
    ]) {
      const names = Object.keys(getTableColumns(table));
      expect(names).not.toContain('tenantId');
      expect(names).not.toContain('tenant_id');
    }
  });

  it('has no credential-shaped column in any supporting table', () => {
    for (const table of [
      crmTags,
      crmTagAssignments,
      crmNotes,
      crmTimelineEvents,
      crmChannelIdentities,
    ]) {
      const names = Object.keys(getTableColumns(table));
      const secretShaped = names.filter((name) =>
        /password|secret|token|credential|api_key|connection|login/i.test(name),
      );
      expect(secretShaped).toEqual([]);
    }
  });
});
