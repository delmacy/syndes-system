import { parseListQueryParams, type ListQuery } from '../crm-dtos';
import {
  validationProblem,
  type CrmProblemFieldError,
} from '../crm-problem-details';

export interface SearchQuery extends ListQuery {
  query: string;
}

type RawValue = Record<string, unknown>;

export function parseSearchQueryParams(raw: RawValue): SearchQuery {
  const errors: CrmProblemFieldError[] = [];
  const query = raw.q;
  if (typeof query !== 'string') {
    errors.push({ field: 'q', rule: 'required' });
  } else {
    const trimmed = query.trim();
    if (
      !trimmed ||
      trimmed.length < 2 ||
      trimmed.length > 200 ||
      hasControlCharacters(trimmed)
    ) {
      errors.push({ field: 'q', rule: 'invalid_value' });
    }
  }
  const pagination = Object.fromEntries(
    Object.entries(raw).filter(([key]) => key !== 'q'),
  );
  const list: ListQuery = parseListQueryParams(pagination);
  if (errors.length) throw validationProblem(errors);
  return { query: (query as string).trim(), ...list };
}

function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    if (char.charCodeAt(0) <= 0x1f || char.charCodeAt(0) === 0x7f) return true;
  }
  return false;
}
