import { CrmProblemException } from './crm-problem-details';
import { parseCreateNoteDto, parseNoteTargetQuery } from './notes/notes-dtos';
import { parseUpsertChannelIdentityDto } from './channel-identities/channel-identity-dtos';
import { parseCreateTagDto } from './tags/tags-dtos';

function errorsOf(run: () => unknown): { field: string; rule: string }[] {
  try {
    run();
  } catch (error) {
    if (error instanceof CrmProblemException) {
      return (
        error.getResponse() as { errors: { field: string; rule: string }[] }
      ).errors;
    }
    throw error;
  }
  throw new Error('expected validation failure');
}

describe('Core CRM supporting DTO validation (CRM-06)', () => {
  it('accepts only 3 or 6 digit hex colors for tags', () => {
    expect(parseCreateTagDto({ name: 'Priority', color: '#aBc' })).toEqual({
      name: 'Priority',
      color: '#aBc',
    });
    expect(
      parseCreateTagDto({ name: 'Priority', color: '#aabbcc' }).color,
    ).toBe('#aabbcc');
    expect(
      errorsOf(() => parseCreateTagDto({ name: 'Priority', color: '#abcd' })),
    ).toContainEqual({
      field: 'color',
      rule: 'invalid_format',
    });
  });

  it('requires one note target and rejects malformed target values', () => {
    expect(
      parseCreateNoteDto({
        personId: '00000000-0000-4000-8000-000000000001',
        body: 'Follow up\nTomorrow',
      }),
    ).toEqual({
      personId: '00000000-0000-4000-8000-000000000001',
      body: 'Follow up\nTomorrow',
    });
    expect(
      errorsOf(() => parseCreateNoteDto({ body: 'Follow up' })),
    ).toContainEqual({
      field: 'target',
      rule: 'required',
    });
    expect(
      errorsOf(() => parseNoteTargetQuery({ personId: 42 })),
    ).toContainEqual({
      field: 'personId',
      rule: 'invalid_format',
    });
  });

  it('keeps external names separate from CRM naming fields', () => {
    expect(
      parseUpsertChannelIdentityDto({
        channel: 'whatsapp',
        externalId: 'contact-1',
        pushName: 'External display',
      }),
    ).toEqual({
      channel: 'whatsapp',
      externalId: 'contact-1',
      pushName: 'External display',
    });
    expect(
      errorsOf(() =>
        parseUpsertChannelIdentityDto({
          channel: 'whatsapp',
          externalId: 'contact-1',
          fullName: 'overwrite',
        }),
      ),
    ).toContainEqual({ field: 'fullName', rule: 'unknown_field' });
  });
});
