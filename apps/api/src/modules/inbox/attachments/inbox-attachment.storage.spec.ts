import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import type { TenantContext } from '../../../platform-core/identity/identity.contracts';
import { InboxAttachmentIntegrityError } from './inbox-attachment.storage';
import { InboxAttachmentStorage } from './inbox-attachment.storage';

function context(tenantId: string): TenantContext {
  return {
    actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    tenantId,
    databaseName: `sdb_${tenantId}`,
    role: 'tenant_member',
    customerScope: 'cpf',
  };
}

function config(storageRoot: string) {
  return {
    storageRoot,
    maxBytes: 10 * 1024 * 1024,
    allowedTypes: new Map([
      ['image/png', ['png']],
      ['image/jpeg', ['jpg', 'jpeg']],
    ]) as ReadonlyMap<string, readonly string[]>,
  };
}

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('INBOX-04 attachment storage', () => {
  let root: string;
  let storage: InboxAttachmentStorage;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'inbox-storage-'));
    await mkdir(root, { recursive: true });
    storage = new InboxAttachmentStorage(config(root));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true }).catch(() => undefined);
  });

  it('generates a server-owned key from the current tenant and extension', () => {
    const key = storage.createObjectKey(context(TENANT_A), 'png');
    expect(key).toMatch(
      new RegExp(
        `^${TENANT_A}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.png$`,
      ),
    );
    expect(() => storage.createObjectKey(context(TENANT_A), 'EXE')).toThrow(
      'Invalid canonical attachment extension',
    );
  });

  it('refuses an object key that names another tenant (cross-tenant)', async () => {
    const foreignKey = `${TENANT_B}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.txt`;
    await expect(
      storage.resolveObjectPath(context(TENANT_A), foreignKey),
    ).rejects.toThrow('Invalid attachment object key');
  });

  it('refuses a malformed object key', async () => {
    for (const bad of [
      'not-a-key',
      `${TENANT_A}/notauuid.txt`,
      `${TENANT_A}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      `${TENANT_A}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.EXE`,
      `../../etc/passwd`,
    ]) {
      await expect(
        storage.resolveObjectPath(context(TENANT_A), bad),
      ).rejects.toThrow(/Invalid attachment object key|escapes/);
    }
  });

  it('writes and reads back bytes with integrity verification', async () => {
    const key = storage.createObjectKey(context(TENANT_A), 'png');
    const bytes = Buffer.from('attachment contents');
    await storage.write(context(TENANT_A), key, bytes);
    const read = await storage.read(context(TENANT_A), key, {
      byteSize: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    expect(read).toEqual(bytes);
  });

  it('rejects a read whose digest no longer matches the metadata', async () => {
    const key = storage.createObjectKey(context(TENANT_A), 'png');
    await storage.write(context(TENANT_A), key, Buffer.from('original'));
    await expect(
      storage.read(context(TENANT_A), key, {
        byteSize: 1,
        sha256: '0'.repeat(64),
      }),
    ).rejects.toBeInstanceOf(InboxAttachmentIntegrityError);
  });

  it('removes an object without throwing when it is absent', async () => {
    const key = storage.createObjectKey(context(TENANT_A), 'png');
    await expect(
      storage.remove(context(TENANT_A), key),
    ).resolves.toBeUndefined();
  });
});
