import {
  CsvInputError,
  encodeCsv,
  MAX_CSV_BYTES,
  MAX_CSV_COLUMNS,
  MAX_CSV_ROWS,
  parseCsv,
} from './csv-parser';

describe('CSV parser and encoder', () => {
  function expectCsvError(input: Buffer | string, code: string): void {
    let thrown: unknown;
    try {
      parseCsv(input);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CsvInputError);
    expect((thrown as CsvInputError).code).toBe(code);
  }

  it('accepts BOM, CRLF, quoted commas, quotes and embedded newlines', () => {
    const csv =
      '\uFEFFname,email\r\n"Doe, Jane","a""b@example.com"\r\n"Line\none",x@y.z';
    const expected = {
      headers: ['name', 'email'],
      rows: [
        ['Doe, Jane', 'a"b@example.com'],
        ['Line\none', 'x@y.z'],
      ],
    };
    expect(parseCsv(csv)).toEqual(expected);
    expect(parseCsv(Buffer.from(csv, 'utf8'))).toEqual(expected);
  });

  it('strips the BOM from raw request bytes', () => {
    const bytes = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('name\r\nAlfa\r\n', 'utf8'),
    ]);
    expect(parseCsv(bytes)).toEqual({
      headers: ['name'],
      rows: [['Alfa']],
    });
  });

  it('rejects malformed input and duplicate headers', () => {
    for (const [input, code] of [
      ['', 'missing_header'],
      ['name,name\na,b', 'duplicate_header'],
      ['name,email\na', 'malformed_csv'],
      ['name\n"open', 'malformed_csv'],
      ['name\n"closed"x', 'malformed_csv'],
      ['name\n"a\nb', 'malformed_csv'],
    ]) {
      expectCsvError(input, code);
    }
  });

  it('enforces byte, row and column limits', () => {
    expectCsvError('a\n' + 'x'.repeat(MAX_CSV_BYTES), 'csv_too_large');
    expectCsvError(Buffer.alloc(MAX_CSV_BYTES + 1, 0x61), 'csv_too_large');
    expectCsvError(
      'a\n' +
        Array(MAX_CSV_ROWS + 1)
          .fill('x')
          .join('\n'),
      'too_many_rows',
    );
    expectCsvError(
      Array(MAX_CSV_COLUMNS + 1)
        .fill('x')
        .join(','),
      'too_many_columns',
    );
  });

  it('accepts a legitimate U+FFFD character and rejects malformed UTF-8 bytes', () => {
    expect(parseCsv('name\n\uFFFD')).toEqual({
      headers: ['name'],
      rows: [['\uFFFD']],
    });
    expect(
      parseCsv(
        Buffer.concat([
          Buffer.from('name\n', 'utf8'),
          Buffer.from([0xef, 0xbf, 0xbd]),
        ]),
      ),
    ).toEqual({
      headers: ['name'],
      rows: [['\uFFFD']],
    });
    expectCsvError(
      Buffer.concat([
        Buffer.from('name\n', 'utf8'),
        Buffer.from([0xff, 0xfe, 0x41]),
      ]),
      'invalid_encoding',
    );
    expectCsvError(
      Buffer.concat([Buffer.from('name\n', 'utf8'), Buffer.from([0xc3, 0x28])]),
      'invalid_encoding',
    );
  });

  it('escapes formulas on export', () => {
    expect(
      encodeCsv([
        ['name', 'note'],
        ['=1+1', 'a,"b"'],
      ]),
    ).toBe('name,note\r\n\'=1+1,"a,""b"""');
    expect(encodeCsv([['-3', '+4', '@cmd', '  =1']])).toBe(
      "'-3,'+4,'@cmd,'  =1",
    );
  });
});
