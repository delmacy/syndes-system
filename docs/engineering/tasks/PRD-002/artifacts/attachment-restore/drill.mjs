#!/usr/bin/env node
/*
 * INBOX-04-R2 — Drill descartável de backup/restore de anexos tenant-scoped.
 *
 * Objetivo: verificar backup, restore, integridade (checksum SHA-256),
 * validação de MIME/tamanho, proteção contra path traversal e negação
 * cross-tenant para anexos do módulo Inbox (PRD-002).
 *
 * Restrições do drill:
 *  - Usa apenas tenant e arquivo sintéticos e descartáveis.
 *  - Nunca toca banco de dados real, provider externo ou dados reais.
 *  - Não modifica source code da aplicação.
 *  - Executa em diretório temporário e faz teardown completo ao final.
 *
 * Execução: node docs/engineering/tasks/PRD-002/artifacts/attachment-restore/drill.mjs
 */

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';

// ---------------------------------------------------------------------------
// Configuração sintética (apenas para o drill; nenhuma leitura de env real)
// ---------------------------------------------------------------------------

const STORAGE_ROOT = join(tmpdir(), `syndes-inbox04-drill-${randomUUID().slice(0, 8)}`);
const BACKUP_ROOT = join(tmpdir(), `syndes-inbox04-drill-backup-${randomUUID().slice(0, 8)}`);
const RESTORE_ROOT = join(tmpdir(), `syndes-inbox04-drill-restore-${randomUUID().slice(0, 8)}`);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB (default do INBOX_ATTACHMENT_MAX_BYTES)
const ALLOWED_TYPES = new Map([
  ['image/png', ['png']],
  ['image/jpeg', ['jpg', 'jpeg']],
  ['image/webp', ['webp']],
  ['application/pdf', ['pdf']],
  ['text/plain', ['txt']],
  ['text/csv', ['csv']],
]);

const TENANT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OBJECT_KEY_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[.]([a-z0-9]{1,10})$/;

// ---------------------------------------------------------------------------
// Estado do drill
// ---------------------------------------------------------------------------

const results = [];
let failures = 0;

function ok(name, detail = '') {
  results.push({ name, status: 'PASS', detail });
  console.log(`  [PASS] ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failures += 1;
  results.push({ name, status: 'FAIL', detail });
  console.log(`  [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function assert(condition, name, detail = '') {
  if (condition) {
    ok(name, detail);
  } else {
    fail(name, detail);
  }
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/** `candidate` está estritamente dentro de `base` (sem traversal, sem sibling). */
function pathInside(base, candidate) {
  const rel = relative(base, candidate);
  return rel.length > 0 && !rel.startsWith('..') && !relative.startsWith === false && !sep.startsWith('/') && !pathIsAbsolute(rel);
}

function pathIsAbsolute(p) {
  return p.startsWith('/') || p.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(p);
}

/** `candidate` começa com `base + separador` (está dentro da árvore). */
function isUnder(base, candidate) {
  const baseNorm = base.endsWith(sep) ? base : base + sep;
  return candidate.startsWith(baseNorm);
}

// ---------------------------------------------------------------------------
// Helpers de "metadados sintéticos" (espelho da tabela inbox_attachments)
// ---------------------------------------------------------------------------

const metadataRows = new Map(); // attachmentId -> { conversationId, objectKey, originalFilename, contentType, byteSize, sha256, tenantId }

function makeAttachmentId() {
  return randomUUID();
}

function makeConversationId() {
  return randomUUID();
}

// ---------------------------------------------------------------------------
// Lógica de storage replicando a defesa em profundidade do código de produção
// (sem importar módulos NestJS — nenhum node_modules disponível)
// ---------------------------------------------------------------------------

const fsPromises = (() => import('node:fs/promises'))();

async function ensureRealDirectory(dir, label) {
  const fs = await fsPromises;
  const info = await fs.lstat(dir);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error(`Attachment ${label} is not a real directory`);
  }
  const canonical = await fs.realpath(dir);
  if (relative(dir, canonical) !== '') {
    throw new Error(`Attachment ${label} resolves through a symlink`);
  }
  return canonical;
}

async function resolveObjectPath(contextTenantId, objectKey) {
  const root = await ensureRealDirectory(STORAGE_ROOT, 'root');
  if (!TENANT_ID_PATTERN.test(contextTenantId)) {
    throw new Error('Invalid server-resolved tenant identifier');
  }
  const match = OBJECT_KEY_PATTERN.exec(objectKey);
  if (!match || match[1] !== contextTenantId) {
    throw new Error('Invalid attachment object key');
  }
  const expected = join(root, contextTenantId);
  await ensureRealDirectory(expected, 'tenant directory');
  if (relative(root, expected) !== contextTenantId) {
    throw new Error('Attachment tenant directory escapes the storage root');
  }
  const target = join(expected, `${match[2]}.${match[3]}`);
  const rel = relative(expected, target);
  if (rel.length === 0 || rel.startsWith('..') || pathIsAbsolute(rel)) {
    throw new Error('Attachment object key escapes the tenant directory');
  }
  return { target, directory: expected };
}

async function writeAttachment(contextTenantId, objectKey, bytes) {
  const { target, directory } = await resolveObjectPath(contextTenantId, objectKey);
  const fs = await fsPromises;
  const temporary = join(directory, `.upload-${randomUUID()}`);
  const handle = await fs.open(temporary, 'w');
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await ensureRealDirectory(directory, 'tenant directory');
  await fs.rename(temporary, target);
}

async function readAttachment(contextTenantId, objectKey, expected) {
  const { target, directory } = await resolveObjectPath(contextTenantId, objectKey);
  const fs = await fsPromises;
  const info = await fs.lstat(target);
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new Error('Attachment object is not a regular file');
  }
  const handle = await fs.open(target, 'r');
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size !== expected.byteSize) {
      throw new Error('Attachment integrity check failed (size mismatch)');
    }
    const resolved = await fs.realpath(target);
    if (!isUnder(directory, resolved)) {
      throw new Error('Attachment object resolved outside its tenant directory');
    }
    const bytes = await handle.readFile();
    const digest = sha256(bytes);
    if (digest !== expected.sha256) {
      throw new Error('Attachment integrity check failed (digest mismatch)');
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

// ---------------------------------------------------------------------------
// Validação de upload (réplica de validateInboxAttachmentUpload)
// ---------------------------------------------------------------------------

function validateUpload(file, config) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new Error('file required');
  }
  const originalFilename = String(file.originalname || '').trim();
  if (
    originalFilename.length === 0 ||
    originalFilename.length > 255 ||
    originalFilename === '.' ||
    originalFilename === '..' ||
    originalFilename.includes('..') ||
    /[/\\:\0]/.test(originalFilename) ||
    /[\x00-\x1f\x7f]/.test(originalFilename) ||
    /^[.\s]|[.\s]$/.test(originalFilename)
  ) {
    throw new Error('invalid_filename');
  }
  const mime = String(file.mimetype || '').split(';')[0]?.trim().toLowerCase() || '';
  if (!mime) throw new Error('mime_not_allowed');
  const allowedExtensions = config.allowedTypes.get(mime);
  if (!allowedExtensions) throw new Error('mime_not_allowed');
  const dot = originalFilename.lastIndexOf('.');
  const extension = dot <= 0 || dot === originalFilename.length - 1 ? null : originalFilename.slice(dot + 1).toLowerCase();
  if (!extension || !allowedExtensions.includes(extension)) {
    throw new Error('extension_mismatch');
  }
  const canonicalExtension = allowedExtensions[0];
  const bytes = file.buffer;
  const byteSize = bytes.byteLength;
  if (byteSize <= 0) throw new Error('invalid_value');
  if (!Number.isSafeInteger(file.size) || (file.size !== 0 && file.size !== byteSize)) {
    throw new Error('invalid_value');
  }
  if (byteSize > config.maxBytes) throw new Error('attachment_too_large');
  const signatureMimes = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);
  if (signatureMimes.has(mime)) {
    const detected = detectSignatureMime(bytes);
    if (detected !== mime) throw new Error('signature_mismatch');
  } else if (mime.startsWith('text/')) {
    if (bytes.includes(0)) throw new Error('signature_mismatch');
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new Error('signature_mismatch');
    }
  }
  return {
    originalFilename,
    contentType: mime,
    extension: canonicalExtension,
    byteSize,
    sha256: sha256(bytes),
    bytes,
  };
}

function detectSignatureMime(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
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

const config = { storageRoot: STORAGE_ROOT, maxBytes: MAX_BYTES, allowedTypes: ALLOWED_TYPES };

// ---------------------------------------------------------------------------
// Cenário sintético (dois tenants, cada um com anexo)
// ---------------------------------------------------------------------------

const TENANT_A = randomUUID();
const TENANT_B = randomUUID();
const CONV_A = makeConversationId();
const CONV_B = makeConversationId();

async function createAttachment(tenantId, conversationId, originalName, mime, bytes) {
  const validated = validateUpload({ originalname: originalName, mimetype: mime, size: bytes.length, buffer: bytes }, config);
  const objectKey = `${tenantId}/${randomUUID()}.${validated.extension}`;
  await writeAttachment(tenantId, objectKey, validated.bytes);
  const attachmentId = makeAttachmentId();
  metadataRows.set(attachmentId, {
    conversationId,
    objectKey,
    originalFilename: validated.originalFilename,
    contentType: validated.contentType,
    byteSize: validated.byteSize,
    sha256: validated.sha256,
    tenantId,
  });
  return { attachmentId, objectKey, validated };
}

async function main() {
  console.log('=== INBOX-04-R2 — Drill de backup/restore de anexos (tenant-scoped) ===');
  console.log(`Data: ${new Date().toISOString()}`);
  console.log(`Tenant A (sintético): ${TENANT_A}`);
  console.log(`Tenant B (sintético): ${TENANT_B}`);
  console.log(`Storage root (descartável): ${STORAGE_ROOT}`);
  console.log('');

  // ---- Setup ----
  await mkdir(STORAGE_ROOT, { recursive: true });
  await mkdir(join(STORAGE_ROOT, TENANT_A), { recursive: true });
  await mkdir(join(STORAGE_ROOT, TENANT_B), { recursive: true });

  // ---- 1. Upload/validação de anexos sintéticos ----
  console.log('1. Validação de upload (MIME/tamanho/assinatura/nome)');

  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03]);
  const txtBytes = Buffer.from('conteudo de texto sintético para teste de anexo', 'utf-8');
  const pdfBytes = Buffer.from('%PDF-1.4 synthetic pdf content for drill', 'utf-8');
  const oversizedBytes = Buffer.alloc(MAX_BYTES + 1);

  // 1a. PNG válido (tenant A)
  try {
    const r = await createAttachment(TENANT_A, CONV_A, 'documento.png', 'image/png', pngBytes);
    ok('upload PNG válido aceito (tenant A)', `sha256=${r.validated.sha256} size=${r.validated.byteSize}`);
  } catch (e) {
    fail('upload PNG válido aceito (tenant A)', e.message);
  }

  // 1b. TXT válido (tenant A)
  try {
    const r = await createAttachment(TENANT_A, CONV_A, 'nota.txt', 'text/plain', txtBytes);
    ok('upload TXT válido aceito (tenant A)', `sha256=${r.validated.sha256} size=${r.validated.byteSize}`);
  } catch (e) {
    fail('upload TXT válido aceito (tenant A)', e.message);
  }

  // 1c. PDF válido (tenant B)
  try {
    const r = await createAttachment(TENANT_B, CONV_B, 'relatorio.pdf', 'application/pdf', pdfBytes);
    ok('upload PDF válido aceito (tenant B)', `sha256=${r.validated.sha256} size=${r.validated.byteSize}`);
  } catch (e) {
    fail('upload PDF válido aceito (tenant B)', e.message);
  }

  // 1d. MIME não permitido
  try {
    validateUpload({ originalname: 'malware.exe', mimetype: 'application/x-msdownload', size: 10, buffer: Buffer.alloc(10) }, config);
    fail('MIME não permitido rejeitado', 'não lançou erro');
  } catch (e) {
    ok('MIME não permitido rejeitado', e.message);
  }

  // 1e. Extensão divergente do MIME
  try {
    validateUpload({ originalname: 'foto.txt', mimetype: 'image/png', size: pngBytes.length, buffer: pngBytes }, config);
    fail('extensão divergente rejeitada', 'não lançou erro');
  } catch (e) {
    ok('extensão divergente rejeitada', e.message);
  }

  // 1f. Tamanho excedente
  try {
    validateUpload({ originalname: 'grande.png', mimetype: 'image/png', size: oversizedBytes.length, buffer: oversizedBytes }, config);
    fail('tamanho excedente rejeitado', 'não lançou erro');
  } catch (e) {
    ok('tamanho excedente rejeitado', e.message);
  }

  // 1g. Nome com traversal
  try {
    validateUpload({ originalname: '../../etc/passwd', mimetype: 'text/plain', size: txtBytes.length, buffer: txtBytes }, config);
    fail('nome com traversal rejeitado', 'não lançou erro');
  } catch (e) {
    ok('nome com traversal rejeitado', e.message);
  }

  // 1h. Assinatura binária divergente (declara PNG, bytes são TXT)
  try {
    validateUpload({ originalname: 'falso.png', mimetype: 'image/png', size: txtBytes.length, buffer: txtBytes }, config);
    fail('assinatura divergente rejeitada', 'não lançou erro');
  } catch (e) {
    ok('assinatura binária divergente rejeitada', e.message);
  }

  console.log('');

  // ---- 2. Checksum antes do backup ----
  console.log('2. Checksum SHA-256 antes do backup');
  const beforeChecksums = new Map();
  for (const [aid, row] of metadataRows) {
    const bytes = await readAttachment(row.tenantId, row.objectKey, { byteSize: row.byteSize, sha256: row.sha256 });
    beforeChecksums.set(aid, sha256(bytes));
    ok(`checksum pré-backup ${row.originalFilename}`, `sha256=${beforeChecksums.get(aid)}`);
  }
  console.log('');

  // ---- 3. Backup (cópia do volume para diretório de backup) ----
  console.log('3. Backup do storage tenant-scoped');
  await mkdir(BACKUP_ROOT, { recursive: true });
  const entries = await readdir(STORAGE_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const srcTenantDir = join(STORAGE_ROOT, entry.name);
    const dstTenantDir = join(BACKUP_ROOT, entry.name);
    await mkdir(dstTenantDir, { recursive: true });
    const files = await readdir(srcTenantDir);
    for (const file of files) {
      await writeFile(join(dstTenantDir, file), await readFile(join(srcTenantDir, file)));
    }
  }
  const backupTenantCount = (await readdir(BACKUP_ROOT, { withFileTypes: true })).filter((e) => e.isDirectory()).length;
  await assert(backupTenantCount >= 2, 'backup contém diretórios de ambos os tenants sintéticos', `tenants no backup=${backupTenantCount}`);
  console.log('');

  // ---- 4. Restore (cópia do backup para diretório de restore isolado) ----
  console.log('4. Restore em ambiente isolado (não ao vivo)');
  await mkdir(RESTORE_ROOT, { recursive: true });
  const restoreEntries = await readdir(BACKUP_ROOT, { withFileTypes: true });
  for (const entry of restoreEntries) {
    if (!entry.isDirectory()) continue;
    const srcTenantDir = join(BACKUP_ROOT, entry.name);
    const dstTenantDir = join(RESTORE_ROOT, entry.name);
    await mkdir(dstTenantDir, { recursive: true });
    const files = await readdir(srcTenantDir);
    for (const file of files) {
      await writeFile(join(dstTenantDir, file), await readFile(join(srcTenantDir, file)));
    }
  }
  const restoreTenantCount = (await readdir(RESTORE_ROOT, { withFileTypes: true })).filter((e) => e.isDirectory()).length;
  await assert(restoreTenantCount >= 2, 'restore recriou diretórios de ambos os tenants', `tenants no restore=${restoreTenantCount}`);
  console.log('');

  // ---- 5. Checksum após restore ----
  console.log('5. Checksum SHA-256 após restore (deve bater com pré-backup e metadado)');
  for (const [aid, row] of metadataRows) {
    const restoredPath = join(RESTORE_ROOT, row.objectKey);
    const fs = await fsPromises;
    const restoredBytes = await fs.readFile(restoredPath);
    const after = sha256(restoredBytes);
    const match = after === beforeChecksums.get(aid) && after === row.sha256;
    await assert(match, `checksum pós-restore ${row.originalFilename}`, `antes=${beforeChecksums.get(aid)} depois=${after} metadado=${row.sha256}`);
  }
  console.log('');

  // ---- 6. Download autorizado (mesmo tenant) ----
  console.log('6. Download autorizado dentro do tenant');
  let authorizedDownloadOk = false;
  for (const [aid, row] of metadataRows) {
    if (row.tenantId === TENANT_A) {
      try {
        const bytes = await readAttachment(TENANT_A, row.objectKey, { byteSize: row.byteSize, sha256: row.sha256 });
        authorizedDownloadOk = bytes.byteLength === row.byteSize;
        ok(`download autorizado ${row.originalFilename} (tenant A)`, `size=${bytes.byteLength}`);
        break;
      } catch (e) {
        fail(`download autorizado ${row.originalFilename}`, e.message);
      }
    }
  }
  if (!authorizedDownloadOk) fail('download autorizado', 'nenhum anexo do tenant A disponível');
  console.log('');

  // ---- 7. Cross-tenant denial ----
  console.log('7. Negação cross-tenant (tenant A tenta ler arquivo do tenant B)');
  let crossTenantDenied = true;
  for (const [aid, row] of metadataRows) {
    if (row.tenantId === TENANT_B) {
      try {
        await readAttachment(TENANT_A, row.objectKey, { byteSize: row.byteSize, sha256: row.sha256 });
        crossTenantDenied = false;
        fail('cross-tenant denial', 'tenant A conseguiu ler arquivo do tenant B');
      } catch {
        ok('cross-tenant denial', `tenant A bloqueado ao ler ${row.objectKey}`);
      }
      break;
    }
  }
  if (!crossTenantDenied) fail('cross-tenant denial', 'não foi negado');
  console.log('');

  // ---- 8. Path traversal ----
  console.log('8. Proteção contra path traversal');
  let traversalBlocked = true;
  const traversalKeys = [
    `${TENANT_A}/../../etc/passwd`,
    `${TENANT_A}/../${TENANT_B}/x.png`,
    `${TENANT_A}/./../../secret.txt`,
  ];
  for (const badKey of traversalKeys) {
    try {
      await resolveObjectPath(TENANT_A, badKey);
      traversalBlocked = false;
      fail('path traversal bloqueado', `chave aceita: ${badKey}`);
    } catch {
      ok('path traversal bloqueado', `chave rejeitada: ${badKey}`);
    }
  }
  if (!traversalBlocked) fail('path traversal', 'pelo menos uma chave de traversal foi aceita');
  console.log('');

  // ---- 9. Chave de objeto nomeia tenant diferente do contexto ----
  console.log('9. Chave de objeto nomeia tenant diferente do contexto');
  let foreignKeyBlocked = true;
  for (const [aid, row] of metadataRows) {
    if (row.tenantId === TENANT_B) {
      try {
        await resolveObjectPath(TENANT_A, row.objectKey);
        foreignKeyBlocked = false;
        fail('chave de tenant estrangeiro bloqueada', 'não lançou erro');
      } catch {
        ok('chave de tenant estrangeiro bloqueada', `objeto ${row.objectKey} rejeitado para contexto A`);
      }
      break;
    }
  }
  if (!foreignKeyBlocked) fail('chave de tenant estrangeiro', 'não foi bloqueada');
  console.log('');

  // ---- 10. Corrupção de checksum (arquivo alterado após backup) ----
  console.log('10. Detecção de checksum divergente (arquivo corrompido)');
  let corruptionDetected = true;
  for (const [aid, row] of metadataRows) {
    if (row.tenantId === TENANT_A) {
      const corruptPath = join(STORAGE_ROOT, row.objectKey);
      const fs = await fsPromises;
      const original = await fs.readFile(corruptPath);
      try {
        const corrupted = Buffer.from(original);
        corrupted[0] = corrupted[0] ^ 0xff;
        await fs.writeFile(corruptPath, corrupted);
        try {
          await readAttachment(TENANT_A, row.objectKey, { byteSize: row.byteSize, sha256: row.sha256 });
          corruptionDetected = false;
          fail('corrupção detectada', 'checksum divergente não foi detectado');
        } catch (e) {
          ok('corrupção detectada', `erro: ${e.message}`);
        }
      } finally {
        await fs.writeFile(corruptPath, original);
      }
      break;
    }
  }
  if (!corruptionDetected) fail('detecção de corrupção', 'não detectada');
  console.log('');

  // ---- Teardown ----
  console.log('11. Teardown (remoção de diretórios temporários)');
  await rm(STORAGE_ROOT, { recursive: true, force: true });
  await rm(BACKUP_ROOT, { recursive: true, force: true });
  await rm(RESTORE_ROOT, { recursive: true, force: true });
  const fs = await fsPromises;
  let allGone = true;
  for (const dir of [STORAGE_ROOT, BACKUP_ROOT, RESTORE_ROOT]) {
    try {
      await fs.access(dir);
      allGone = false;
    } catch { /* gone */ }
  }
  await assert(allGone, 'teardown completo', 'todos os diretórios temporários removidos');

  // ---- Resultado final ----
  console.log('');
  console.log('=== Resultado ===');
  console.log(`Total de verificações: ${results.length}`);
  console.log(`Passou: ${results.filter((r) => r.status === 'PASS').length}`);
  console.log(`Falhou: ${failures}`);
  console.log(`Resultado geral: ${failures === 0 ? 'PASS' : 'BLOCKED'}`);
  console.log('');

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Drill falhou com erro não tratado:', error);
  process.exit(1);
});
