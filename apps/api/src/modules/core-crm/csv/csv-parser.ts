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

/** Parse bounded RFC 4180 comma-delimited UTF-8 input. */
export function parseCsv(input: string): ParsedCsv {
  if (Buffer.byteLength(input, 'utf8') > MAX_CSV_BYTES) {
    throw new CsvInputError('csv_too_large', 'CSV exceeds the 10 MiB limit.');
  }
  if (input.includes('\uFFFD')) {
    throw new CsvInputError('invalid_encoding', 'CSV must be valid UTF-8.');
  }

  const source = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
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
