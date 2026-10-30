import path from 'node:path';

/**
 * INBOX-04 private attachment storage configuration.
 *
 * Everything here is resolved from the trusted server environment at module
 * construction; no request value can influence the storage root, the size
 * limit or the allowlist. Invalid configuration fails closed (the module does
 * not start), so a deployment can never silently accept an unlimited file or
 * a webroot directory.
 */

/** Reviewed hard ceiling; configuration may only lower it, never exceed it. */
export const INBOX_ATTACHMENT_HARD_MAX_BYTES = 25 * 1024 * 1024;
/** Documented default when INBOX_ATTACHMENT_MAX_BYTES is absent. */
export const INBOX_ATTACHMENT_DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
/** Default root when INBOX_ATTACHMENT_STORAGE_DIR is absent: private, outside any webroot. */
export const INBOX_ATTACHMENT_DEFAULT_DIRECTORY = path.join(
  'var',
  'inbox-attachments',
);

/**
 * Default allowlist. Extensions are the only names accepted for a MIME type;
 * the FIRST extension is the canonical one used for the server-generated
 * object key, so the stored filename never comes from the client.
 */
export const INBOX_ATTACHMENT_DEFAULT_ALLOWED_TYPES =
  'image/png:png,image/jpeg:jpg|jpeg,image/webp:webp,application/pdf:pdf,text/plain:txt,text/csv:csv';

const MIME_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/;
const EXTENSION_PATTERN = /^[a-z0-9]{1,10}$/;
const WEBROOT_SEGMENTS = new Set([
  'public',
  'static',
  'wwwroot',
  'htdocs',
  'webroot',
  'public_html',
]);

export interface InboxAttachmentConfig {
  /** Absolute private directory outside any webroot. */
  storageRoot: string;
  /** Configured maximum accepted size, never above the hard ceiling. */
  maxBytes: number;
  /** MIME -> allowed extensions; the first extension is canonical. */
  allowedTypes: ReadonlyMap<string, readonly string[]>;
}

export const INBOX_ATTACHMENT_CONFIG = Symbol('INBOX_ATTACHMENT_CONFIG');

/** Parses and validates configuration; throws a fixed-text Error on failure. */
export function readInboxAttachmentConfig(
  env: NodeJS.ProcessEnv,
  cwd: string = process.cwd(),
): InboxAttachmentConfig {
  return {
    storageRoot: resolveStorageRoot(env.INBOX_ATTACHMENT_STORAGE_DIR, cwd),
    maxBytes: parseMaxBytes(env.INBOX_ATTACHMENT_MAX_BYTES),
    allowedTypes: parseAllowedTypes(env.INBOX_ATTACHMENT_ALLOWED_TYPES),
  };
}

export function parseMaxBytes(raw: string | undefined): number {
  const value = raw?.trim();
  if (!value) return INBOX_ATTACHMENT_DEFAULT_MAX_BYTES;
  if (!/^\d+$/.test(value)) {
    throw new Error('INBOX_ATTACHMENT_MAX_BYTES must be a positive integer');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error('INBOX_ATTACHMENT_MAX_BYTES must be a positive integer');
  }
  if (parsed > INBOX_ATTACHMENT_HARD_MAX_BYTES) {
    throw new Error(
      `INBOX_ATTACHMENT_MAX_BYTES may not exceed the reviewed ceiling of ${INBOX_ATTACHMENT_HARD_MAX_BYTES} bytes`,
    );
  }
  return parsed;
}

export function parseAllowedTypes(
  raw: string | undefined,
): ReadonlyMap<string, readonly string[]> {
  const source = (raw ?? INBOX_ATTACHMENT_DEFAULT_ALLOWED_TYPES).trim();
  if (!source)
    throw new Error('INBOX_ATTACHMENT_ALLOWED_TYPES may not be empty');
  const allowed = new Map<string, readonly string[]>();
  for (const entry of source.split(',')) {
    const [rawMime, rawExtensions] = entry.split(':');
    const mime = rawMime?.trim().toLowerCase();
    if (!mime || !MIME_PATTERN.test(mime) || mime.includes('*')) {
      throw new Error(
        'INBOX_ATTACHMENT_ALLOWED_TYPES has an invalid MIME type',
      );
    }
    if (allowed.has(mime)) {
      throw new Error('INBOX_ATTACHMENT_ALLOWED_TYPES repeats a MIME type');
    }
    const extensions = (rawExtensions ?? '')
      .split('|')
      .map((extension) => extension.trim().toLowerCase());
    if (
      extensions.length === 0 ||
      extensions.some(
        (extension) =>
          !EXTENSION_PATTERN.test(extension) || extension.includes('*'),
      )
    ) {
      throw new Error(
        'INBOX_ATTACHMENT_ALLOWED_TYPES has an invalid extension',
      );
    }
    if (new Set(extensions).size !== extensions.length) {
      throw new Error('INBOX_ATTACHMENT_ALLOWED_TYPES repeats an extension');
    }
    // The same extension may not map to two MIME types: the stored
    // content type would then be ambiguous on download.
    for (const [knownMime, knownExtensions] of allowed) {
      for (const extension of extensions) {
        if (knownExtensions.includes(extension)) {
          throw new Error(
            'INBOX_ATTACHMENT_ALLOWED_TYPES maps one extension to multiple MIME types',
          );
        }
      }
      void knownMime;
    }
    allowed.set(mime, extensions);
  }
  return allowed;
}

export function resolveStorageRoot(
  raw: string | undefined,
  cwd: string = process.cwd(),
): string {
  const source = (raw ?? INBOX_ATTACHMENT_DEFAULT_DIRECTORY).trim();
  if (!source || source.includes('\0')) {
    throw new Error('INBOX_ATTACHMENT_STORAGE_DIR is invalid');
  }
  const resolved = path.resolve(cwd, source);
  if (resolved === path.parse(resolved).root) {
    throw new Error(
      'INBOX_ATTACHMENT_STORAGE_DIR may not be the filesystem root',
    );
  }
  const segments = resolved
    .split(/[\\/]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.toLowerCase());
  if (segments.some((segment) => WEBROOT_SEGMENTS.has(segment))) {
    throw new Error(
      'INBOX_ATTACHMENT_STORAGE_DIR must stay outside every webroot',
    );
  }
  for (let index = 0; index < segments.length - 1; index += 1) {
    if (segments[index] === 'apps' && segments[index + 1] === 'web') {
      throw new Error(
        'INBOX_ATTACHMENT_STORAGE_DIR must stay outside the web application',
      );
    }
  }
  return resolved;
}
