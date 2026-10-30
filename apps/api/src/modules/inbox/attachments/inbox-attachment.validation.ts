import { HttpStatus } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  CrmProblemException,
  validationProblem,
} from '../../core-crm/crm-problem-details';
import type { InboxAttachmentConfig } from './inbox-attachment.config';

/**
 * INBOX-04 upload validation, independent of Express/multer so it is fully
 * unit-testable. It never trusts the client-provided filename as a location:
 * the name is accepted only as display metadata (path separators, traversal
 * and control characters are rejected) while the storage extension is chosen
 * by the server from the configured allowlist entry matched by the declared
 * MIME type.
 *
 * Layered checks:
 * 1. filename is a single, sane segment (no `/`, `\`, `..`, drive colon,
 *    control character, NUL or overlong name);
 * 2. declared MIME (parameters stripped, lower-cased) is allowlisted;
 * 3. the filename extension belongs to that exact MIME entry;
 * 4. the byte signature agrees with the declared MIME for formats that have
 *    one (PNG/JPEG/WebP/PDF); text formats must be valid UTF-8 without NUL;
 * 5. byte length is positive and within the configured limit (which can never
 *    exceed the reviewed hard ceiling);
 * 6. SHA-256 and canonical metadata are returned for durable persistence.
 */

export interface InboxUploadFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface ValidatedInboxAttachment {
  originalFilename: string;
  contentType: string;
  extension: string;
  byteSize: number;
  sha256: string;
  bytes: Buffer;
}

const FILENAME_MAX_LENGTH = 255;
const EXTENSION_PATTERN = /^[a-z0-9]{1,10}$/;

/** Signature-required MIME types: a declared type must match its magic bytes. */
const SIGNATURE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);

export function attachmentTooLargeProblem(): CrmProblemException {
  return new CrmProblemException({
    code: 'attachment_too_large',
    statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
    detail: 'Attachment exceeds the configured size limit.',
  });
}

export function validateInboxAttachmentUpload(
  upload: InboxUploadFile | undefined,
  config: InboxAttachmentConfig,
): ValidatedInboxAttachment {
  if (!upload || !Buffer.isBuffer(upload.buffer)) {
    throw validationProblem([{ field: 'file', rule: 'required' }]);
  }
  const originalFilename = sanitizeAttachmentFilename(upload.originalname);
  const contentType = normalizeDeclaredMime(upload.mimetype);
  const allowedExtensions = config.allowedTypes.get(contentType);
  if (!allowedExtensions) {
    throw validationProblem([{ field: 'file', rule: 'mime_not_allowed' }]);
  }
  const extension = extensionOf(originalFilename);
  if (!extension || !allowedExtensions.includes(extension)) {
    throw validationProblem([{ field: 'file', rule: 'extension_mismatch' }]);
  }
  const canonicalExtension = allowedExtensions[0];
  if (!EXTENSION_PATTERN.test(canonicalExtension)) {
    // Configuration is validated at startup; this is defensive only.
    throw validationProblem([{ field: 'file', rule: 'invalid_value' }]);
  }

  const bytes = upload.buffer;
  const byteSize = bytes.byteLength;
  if (byteSize <= 0) {
    throw validationProblem([{ field: 'file', rule: 'invalid_value' }]);
  }
  if (
    !Number.isSafeInteger(upload.size) ||
    (upload.size !== 0 && upload.size !== byteSize)
  ) {
    throw validationProblem([{ field: 'file', rule: 'invalid_value' }]);
  }
  if (byteSize > config.maxBytes) throw attachmentTooLargeProblem();

  if (SIGNATURE_MIME_TYPES.has(contentType)) {
    if (detectSignatureMime(bytes) !== contentType) {
      throw validationProblem([{ field: 'file', rule: 'signature_mismatch' }]);
    }
  } else if (contentType.startsWith('text/')) {
    if (!isSafeUtf8Text(bytes)) {
      throw validationProblem([{ field: 'file', rule: 'signature_mismatch' }]);
    }
  }

  return {
    originalFilename,
    contentType,
    extension: canonicalExtension,
    byteSize,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes,
  };
}

/**
 * Accepts the client filename only as a bounded display segment. It is never
 * joined to a path; the object key is generated from the server context.
 */
export function sanitizeAttachmentFilename(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw validationProblem([{ field: 'file', rule: 'invalid_filename' }]);
  }
  const filename = raw.trim();
  if (
    filename.length === 0 ||
    filename.length > FILENAME_MAX_LENGTH ||
    filename === '.' ||
    filename === '..' ||
    filename.includes('..') ||
    /[/\\:\0]/.test(filename) ||
    hasControlCharacters(filename) ||
    /^[.\s]|[.\s]$/.test(filename)
  ) {
    throw validationProblem([{ field: 'file', rule: 'invalid_filename' }]);
  }
  return filename;
}

function normalizeDeclaredMime(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw validationProblem([{ field: 'file', rule: 'mime_not_allowed' }]);
  }
  const mime = raw.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!mime) {
    throw validationProblem([{ field: 'file', rule: 'mime_not_allowed' }]);
  }
  return mime;
}

function extensionOf(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0 || dot === filename.length - 1) return null;
  const extension = filename.slice(dot + 1).toLowerCase();
  return EXTENSION_PATTERN.test(extension) ? extension : null;
}

function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    if (char.charCodeAt(0) <= 0x1f || char.charCodeAt(0) === 0x7f) return true;
  }
  return false;
}

/** Returns the MIME type proven by the bytes, or null when not recognizable. */
export function detectSignatureMime(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    if (bytes[2] === 0xff) return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }
  return null;
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function isSafeUtf8Text(bytes: Buffer): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}
