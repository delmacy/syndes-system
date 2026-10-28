export const MAX_CSV_BYTES = 10 * 1024 * 1024;
export const MAX_CSV_ROWS = 10_000;
export const MAX_CSV_COLUMNS = 30;

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export class CsvInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CsvInputError';
  }
}

/**
 * Parse bounded RFC 4180 comma-delimited UTF-8 input.
 *
 * Encoding check: the HTTP boundary keeps the request bytes intact (see
 * `csv-body-parser.ts`), so the parser decodes them itself with a fatal UTF-8
 * decoder. A malformed byte sequence is rejected as `invalid_encoding` and
 * never reaches the CRM, while a legitimate U+FFFD character inside a valid
 * UTF-8 file is accepted and stored as the character it is.
 */
export function parseCsv(input: Buffer | string): ParsedCsv {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  if (bytes.byteLength > MAX_CSV_BYTES) {
    throw new CsvInputError('csv_too_large', 'CSV exceeds the 10 MiB limit.');
  }

  const source = decodeUtf8(bytes);
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (afterQuote && char !== ',' && char !== '\r' && char !== '\n') {
      throw new CsvInputError('malformed_csv', 'Unexpected text after quote.');
    }
    if (char === '"') {
      if (field.length > 0 || afterQuote) {
        throw new CsvInputError('malformed_csv', 'Unexpected quote in field.');
      }
      quoted = true;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      afterQuote = false;
      continue;
    }
    if (char === '\r' || char === '\n') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field);
      records.push(row);
      if (records.length > MAX_CSV_ROWS + 1) {
        throw new CsvInputError('too_many_rows', 'CSV exceeds 10,000 rows.');
      }
      row = [];
      field = '';
      afterQuote = false;
      continue;
    }
    field += char;
  }
  if (quoted)
    throw new CsvInputError('malformed_csv', 'Unclosed quoted field.');
  if (field.length > 0 || row.length > 0 || afterQuote) {
    row.push(field);
    records.push(row);
  }
  if (records.length > MAX_CSV_ROWS + 1) {
    throw new CsvInputError('too_many_rows', 'CSV exceeds 10,000 rows.');
  }
  while (
    records.length &&
    records[records.length - 1].every((cell) => cell === '')
  ) {
    records.pop();
  }
  if (!records.length) {
    throw new CsvInputError('missing_header', 'CSV header row is required.');
  }
  const headers = records.shift()!;
  if (!headers.length || headers.some((header) => !header.trim())) {
    throw new CsvInputError('invalid_header', 'CSV headers must not be empty.');
  }
  if (headers.length > MAX_CSV_COLUMNS) {
    throw new CsvInputError('too_many_columns', 'CSV exceeds 30 columns.');
  }
  if (new Set(headers).size !== headers.length) {
    throw new CsvInputError('duplicate_header', 'CSV headers must be unique.');
  }
  if (records.some((record) => record.length !== headers.length)) {
    throw new CsvInputError('malformed_csv', 'Rows must match header width.');
  }
  return { headers, rows: records };
}

export function encodeCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

function escapeCsvCell(value: string): string {
  let safe = value;
  if (/^\s*[=+\-@]/.test(safe)) safe = `'${safe}`;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Decodes the request bytes as strict UTF-8. Malformed byte sequences are a
 * client error, never a silently repaired record.
 */
function decodeUtf8(bytes: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(stripBom(bytes));
  } catch {
    throw new CsvInputError('invalid_encoding', 'CSV must be valid UTF-8.');
  }
}

function stripBom(bytes: Buffer): Buffer {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return bytes.subarray(3);
  }
  return bytes;
}
