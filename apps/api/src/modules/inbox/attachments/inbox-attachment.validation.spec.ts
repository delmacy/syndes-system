import { validationProblem } from '../../core-crm/crm-problem-details';
import {
  attachmentTooLargeProblem,
  detectSignatureMime,
  sanitizeAttachmentFilename,
  validateInboxAttachmentUpload,
} from './inbox-attachment.validation';

function config(
  overrides: Partial<{
    maxBytes: number;
    allowedTypes: [string, string[]][];
  }> = {},
): {
  storageRoot: string;
  maxBytes: number;
  allowedTypes: ReadonlyMap<string, readonly string[]>;
} {
  return {
    storageRoot: 'var/inbox-attachments',
    maxBytes: overrides.maxBytes ?? 10 * 1024 * 1024,
    allowedTypes: new Map(
      overrides.allowedTypes ?? [
        ['image/png', ['png']],
        ['image/jpeg', ['jpg', 'jpeg']],
        ['text/plain', ['txt']],
      ],
    ),
  };
}

function upload(overrides: Record<string, unknown> = {}) {
  return {
    originalname: 'foto.png',
    mimetype: 'image/png',
    size: 16,
    buffer: Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // PNG signature
      0x00,
      0x00,
      0x00,
      0x0d,
      0x49,
      0x48,
      0x44,
      0x52, // IHDR
    ]),
    ...overrides,
  } as { originalname: string; mimetype: string; size: number; buffer: Buffer };
}

describe('INBOX-04 attachment validation', () => {
  it('accepts a valid PNG upload and returns canonical metadata', () => {
    const file = upload();
    const result = validateInboxAttachmentUpload(file, config());
    expect(result.extension).toBe('png');
    expect(result.contentType).toBe('image/png');
    expect(result.byteSize).toBe(16);
    expect(result.originalFilename).toBe('foto.png');
    expect(result.sha256).toHaveLength(64);
    expect(result.bytes).toBe(file.buffer);
  });

  it('rejects a missing upload', () => {
    expect(() =>
      validateInboxAttachmentUpload(undefined as any, config()),
    ).toThrow(validationProblem([{ field: 'file', rule: 'required' }]));
    expect(() =>
      validateInboxAttachmentUpload({ buffer: undefined } as any, config()),
    ).toThrow(validationProblem([{ field: 'file', rule: 'required' }]));
  });

  it('rejects path traversal and invalid filenames before any MIME check', () => {
    for (const name of [
      '../../etc/passwd',
      '..',
      'folder/../file.png',
      'a/b.png',
      'a\\b.png',
      'a:b.png',
      'a\u0000b.png',
      '.',
      '.hidden',
    ]) {
      expect(() =>
        validateInboxAttachmentUpload(upload({ originalname: name }), config()),
      ).toThrow(
        validationProblem([{ field: 'file', rule: 'invalid_filename' }]),
      );
    }
  });

  it('sanitizes a plain display filename and never treats it as a path', () => {
    expect(sanitizeAttachmentFilename('foto.png')).toBe('foto.png');
    expect(sanitizeAttachmentFilename('  foto.png  ')).toBe('foto.png');
    for (const bad of [
      '../../etc/passwd',
      '..',
      'a/b',
      'a\\b',
      'a:b',
      'a\u0000b',
      '.',
    ]) {
      expect(() => sanitizeAttachmentFilename(bad)).toThrow(
        validationProblem([{ field: 'file', rule: 'invalid_filename' }]),
      );
    }
    expect(() => sanitizeAttachmentFilename(undefined as any)).toThrow(
      validationProblem([{ field: 'file', rule: 'invalid_filename' }]),
    );
  });

  it('rejects a MIME type outside the allowlist', () => {
    expect(() =>
      validateInboxAttachmentUpload(
        upload({ originalname: 'x.exe', mimetype: 'application/x-msdownload' }),
        config(),
      ),
    ).toThrow(validationProblem([{ field: 'file', rule: 'mime_not_allowed' }]));
  });

  it('rejects an extension that does not match the declared MIME', () => {
    expect(() =>
      validateInboxAttachmentUpload(
        upload({ originalname: 'document.txt' }),
        config(),
      ),
    ).toThrow(
      validationProblem([{ field: 'file', rule: 'extension_mismatch' }]),
    );
    expect(() =>
      validateInboxAttachmentUpload(
        upload({ originalname: 'image' }),
        config(),
      ),
    ).toThrow(
      validationProblem([{ field: 'file', rule: 'extension_mismatch' }]),
    );
  });

  it('rejects an empty buffer', () => {
    expect(() =>
      validateInboxAttachmentUpload(
        upload({ buffer: Buffer.alloc(0), size: 0 }),
        config(),
      ),
    ).toThrow(validationProblem([{ field: 'file', rule: 'invalid_value' }]));
  });

  it('rejects a declared size that disagrees with the buffer', () => {
    expect(() =>
      validateInboxAttachmentUpload(upload({ size: 7 }), config()),
    ).toThrow(validationProblem([{ field: 'file', rule: 'invalid_value' }]));
  });

  it('rejects an upload above the configured limit', () => {
    const big = upload({ size: 100, buffer: Buffer.alloc(100) });
    expect(() =>
      validateInboxAttachmentUpload(big, config({ maxBytes: 50 })),
    ).toThrow(attachmentTooLargeProblem());
  });

  it('rejects a signature mismatch for a signature-required MIME', () => {
    expect(() =>
      validateInboxAttachmentUpload(
        upload({ buffer: Buffer.from('not a png') }),
        config(),
      ),
    ).toThrow(
      validationProblem([{ field: 'file', rule: 'signature_mismatch' }]),
    );
  });

  it('rejects text that is not safe UTF-8 (contains NUL)', () => {
    const cfg = config({ allowedTypes: [['text/plain', ['txt']]] });
    const bytes = Buffer.from(['text', '\u0000'].join(''));
    expect(() =>
      validateInboxAttachmentUpload(
        upload({
          originalname: 'note.txt',
          mimetype: 'text/plain',
          buffer: bytes,
          size: bytes.byteLength,
        }),
        cfg,
      ),
    ).toThrow(
      validationProblem([{ field: 'file', rule: 'signature_mismatch' }]),
    );
  });

  it('accepts valid UTF-8 text', () => {
    const cfg = config({ allowedTypes: [['text/plain', ['txt']]] });
    const bytes = Buffer.from('ol\u00e1 mundo');
    const result = validateInboxAttachmentUpload(
      upload({
        originalname: 'note.txt',
        mimetype: 'text/plain',
        buffer: bytes,
        size: bytes.byteLength,
      }),
      cfg,
    );
    expect(result.extension).toBe('txt');
    expect(result.contentType).toBe('text/plain');
  });
});

describe('detectSignatureMime', () => {
  it('recognizes PNG, JPEG, PDF and WebP magic bytes', () => {
    expect(
      detectSignatureMime(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe('image/png');
    expect(detectSignatureMime(Buffer.from([0xff, 0xd8, 0xff]))).toBe(
      'image/jpeg',
    );
    expect(detectSignatureMime(Buffer.from('%PDF-1.4'))).toBe(
      'application/pdf',
    );
    expect(
      detectSignatureMime(
        Buffer.from([
          0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42,
          0x50,
        ]),
      ),
    ).toBe('image/webp');
  });

  it('returns null for unrecognizable bytes', () => {
    expect(detectSignatureMime(Buffer.from('hello world'))).toBeNull();
    expect(detectSignatureMime(Buffer.alloc(0))).toBeNull();
  });
});
