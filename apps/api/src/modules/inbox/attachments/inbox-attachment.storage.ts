import { Inject, Injectable, Logger } from '@nestjs/common';
import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { OnModuleInit } from '@nestjs/common';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import {
  INBOX_ATTACHMENT_CONFIG,
  type InboxAttachmentConfig,
} from './inbox-attachment.config';

const TENANT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OBJECT_KEY_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[.]([a-z0-9]{1,10})$/;
/** Refuse to follow a symlink at the final path component where supported. */
const O_NOFOLLOW =
  process.platform !== 'win32' && typeof constants.O_NOFOLLOW === 'number'
    ? constants.O_NOFOLLOW
    : 0;
const FILE_READ_FLAGS = constants.O_RDONLY | O_NOFOLLOW;
const FILE_CREATE_FLAGS =
  constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | O_NOFOLLOW;

/** Raised when stored bytes no longer match the durable metadata. */
export class InboxAttachmentIntegrityError extends Error {
  constructor() {
    super('Stored attachment does not match its metadata');
    this.name = 'InboxAttachmentIntegrityError';
  }
}

/**
 * INBOX-04 private tenant-scoped filesystem storage.
 *
 * Layout: `<storageRoot>/<tenant uuid>/<random uuid>.<canonical extension>`.
 * Both path components are server-generated: the tenant comes from the
 * server-resolved TenantContext and the filename from the validated
 * allowlist entry, never from the upload's original name or any request path.
 *
 * Defense in depth beyond configuration:
 * - the storage root is validated at startup (absolute, outside webroots),
 * - every key is re-parsed here and must resolve inside the tenant directory
 *   of the CURRENT server context; a corrupted/malicious database row can
 *   never make the API read another tenant's file or a traversal path;
 * - symlinks/junctions are rejected for the root, each tenant directory and
 *   each stored file, and `realpath` must stay under the canonical root, so a
 *   link planted inside the volume cannot redirect a read or write outside it;
 * - files are opened with `O_NOFOLLOW` where the platform supports it, and the
 *   parent directory is revalidated immediately before a rename;
 * - tenant directories are created with mode 0700 and files with 0600,
 * - bytes are written to a temporary sibling first and renamed, so a partial
 *   upload never becomes a readable attachment,
 * - downloads re-verify size and SHA-256 against the tenant database row.
 *
 * Residual limitation: Node has no `openat`/`dirfd`, so a privileged local
 * attacker who can atomically swap a directory between the final validation
 * and the open is outside the process isolation this service can provide.
 */
@Injectable()
export class InboxAttachmentStorage implements OnModuleInit {
  private readonly logger = new Logger(InboxAttachmentStorage.name);

  constructor(
    @Inject(INBOX_ATTACHMENT_CONFIG)
    private readonly config: InboxAttachmentConfig,
  ) {}

  /** Fail fast: the configured root must exist as a real, non-symlink dir. */
  async onModuleInit(): Promise<void> {
    await this.assertStorageRoot();
  }

  /** Server-generated object key; the only value ever persisted. */
  createObjectKey(context: TenantContext, canonicalExtension: string): string {
    const tenantId = this.assertTenantId(context.tenantId);
    if (!/^[a-z0-9]{1,10}$/.test(canonicalExtension)) {
      throw new Error('Invalid canonical attachment extension');
    }
    return `${tenantId}/${randomUUID()}.${canonicalExtension}`;
  }

  async write(
    context: TenantContext,
    objectKey: string,
    bytes: Buffer,
  ): Promise<void> {
    const { target, directory } = await this.resolveObjectPath(
      context,
      objectKey,
    );
    const temporary = path.join(directory, `.upload-${randomUUID()}`);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temporary, FILE_CREATE_FLAGS, 0o600);
      await handle.writeFile(bytes);
      await handle.sync();
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    } finally {
      await handle?.close();
    }
    try {
      // Revalidate immediately before publishing the object. On POSIX rename
      // replaces a symlink at the final component atomically, so a planted
      // link never becomes the file that is read.
      await this.assertRealDirectory(directory, 'tenant directory');
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  async read(
    context: TenantContext,
    objectKey: string,
    expected: { byteSize: number; sha256: string },
  ): Promise<Buffer> {
    const { target, directory } = await this.resolveObjectPath(
      context,
      objectKey,
    );
    const info = await lstat(target);
    if (info.isSymbolicLink() || !info.isFile()) {
      this.logger.error(
        'Attachment object is not a regular file; details withheld.',
      );
      throw new InboxAttachmentIntegrityError();
    }
    const handle = await open(target, FILE_READ_FLAGS);
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.size !== expected.byteSize) {
        this.logger.error(
          'Attachment integrity check failed (size mismatch); details withheld.',
        );
        throw new InboxAttachmentIntegrityError();
      }
      const resolved = await realpath(target);
      if (!isInside(directory, resolved)) {
        this.logger.error(
          'Attachment object resolved outside its tenant directory; details withheld.',
        );
        throw new InboxAttachmentIntegrityError();
      }
      const bytes = await handle.readFile();
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (digest !== expected.sha256) {
        this.logger.error(
          'Attachment integrity check failed (digest mismatch); details withheld.',
        );
        throw new InboxAttachmentIntegrityError();
      }
      return bytes;
    } finally {
      await handle.close();
    }
  }

  async remove(context: TenantContext, objectKey: string): Promise<void> {
    const { target } = await this.resolveObjectPath(context, objectKey);
    await unlink(target).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  /**
   * Resolves a persisted key against the current server context only. Any
   * key that names another tenant, escapes the root or does not match the
   * reviewed shape is refused before touching the filesystem.
   */
  private async resolveObjectPath(
    context: TenantContext,
    objectKey: string,
  ): Promise<{ target: string; directory: string }> {
    const tenantId = this.assertTenantId(context.tenantId);
    const match = OBJECT_KEY_PATTERN.exec(objectKey);
    if (!match || match[1] !== tenantId) {
      throw new Error('Invalid attachment object key');
    }
    const root = await this.assertStorageRoot();
    const directory = await this.assertTenantDirectory(root, tenantId);
    const target = path.join(directory, `${match[2]}.${match[3]}`);
    if (!isInside(directory, target)) {
      throw new Error('Attachment object key escapes the tenant directory');
    }
    return { target, directory };
  }

  /**
   * Creates/validates the configured root. A symlinked root or an ancestor
   * that resolves elsewhere is rejected so every later containment check uses
   * the canonical directory.
   */
  private async assertStorageRoot(): Promise<string> {
    const configured = path.resolve(this.config.storageRoot);
    await mkdir(configured, { recursive: true, mode: 0o700 });
    const canonical = await this.assertRealDirectory(configured, 'root');
    // A parent symlink (for example C:\link\attachments) would make `configured`
    // differ from its realpath even though the leaf itself is a directory.
    if (path.relative(configured, canonical) !== '') {
      throw new Error('Attachment storage root must not be a symlink');
    }
    return canonical;
  }

  private async assertTenantDirectory(
    root: string,
    tenantId: string,
  ): Promise<string> {
    const expected = path.join(root, tenantId);
    await mkdir(expected, { recursive: true, mode: 0o700 });
    const canonical = await this.assertRealDirectory(
      expected,
      'tenant directory',
    );
    if (path.relative(root, canonical) !== tenantId) {
      throw new Error('Attachment tenant directory escapes the storage root');
    }
    return canonical;
  }

  /** `lstat` before `realpath` so a link is never silently followed. */
  private async assertRealDirectory(
    target: string,
    label: string,
  ): Promise<string> {
    const info = await lstat(target);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error(`Attachment ${label} is not a real directory`);
    }
    const canonical = await realpath(target);
    if (path.relative(target, canonical) !== '') {
      throw new Error(`Attachment ${label} resolves through a symlink`);
    }
    return canonical;
  }

  private assertTenantId(tenantId: string): string {
    if (!TENANT_ID_PATTERN.test(tenantId)) {
      throw new Error('Invalid server-resolved tenant identifier');
    }
    return tenantId;
  }
}

/** True when `candidate` is strictly inside `base` (no traversal, no sibling). */
function isInside(base: string, candidate: string): boolean {
  const relative = path.relative(base, candidate);
  return (
    relative.length > 0 &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  );
}
