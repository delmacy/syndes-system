import {
  CsvInputError,
  encodeCsv,
  MAX_CSV_BYTES,
  MAX_CSV_COLUMNS,
  MAX_CSV_ROWS,
  parseCsv,
} from './csv-parser';

describe('CSV parser and encoder', () => {
  function expectCsvError(input: string, code: string): void {
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
    expect(
      parseCsv(
        '\uFEFFname,email\r\n"Doe, Jane","a""b@example.com"\r\n"Line\none",x@y.z',
      ),
    ).toEqual({
      headers: ['name', 'email'],
      rows: [
        ['Doe, Jane', 'a"b@example.com'],
        ['Line\none', 'x@y.z'],
      ],
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

  it('rejects invalid unicode replacement characters and escapes formulas on export', () => {
    expect(() => parseCsv('name\n\uFFFD')).toThrow(CsvInputError);
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
