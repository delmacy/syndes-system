#!/usr/bin/env node
// Coleta a procedência de um commit para o registro auditável de CI.
//
// Saída: provenance.json no diretório corrente e um JSON de uma linha em
// $GITHUB_OUTPUT (quando presente), consumido pelo job de auditoria.
//
// Não falha por trailers ausentes: quem decide exigir é o workflow, para que a
// adoção possa ser gradual sem quebrar branches em andamento.
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const REQUIRED_TRAILERS = [
  ['worktree', 'Orca-Worktree'],
  ['agent', 'Orca-Agent'],
  ['session', 'Orca-Session'],
];

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function tryGit(...args) {
  try {
    return git(...args);
  } catch {
    return '';
  }
}

function readEvent() {
  const file = process.env.GITHUB_EVENT_PATH;
  if (!file || !existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function parseTrailers(sha) {
  const raw = tryGit('log', '-1', '--format=%(trailers)', sha);
  const map = {};
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) map[key] = value;
  }
  return map;
}

const event = readEvent();
const eventName = process.env.GITHUB_EVENT_NAME || 'unknown';
const headSha = git('rev-parse', 'HEAD');

// Base: o SHA de destino do PR é a referência correta; em push usamos o pai do
// commit ou, na falta dele, o merge-base com a branch padrão.
let baseSha = '';
let baseSource = '';
if (event.pull_request?.base?.sha) {
  baseSha = event.pull_request.base.sha;
  baseSource = 'pull_request.base.sha';
} else if (tryGit('rev-parse', '--verify', 'HEAD^')) {
  baseSha = tryGit('rev-parse', 'HEAD^');
  baseSource = 'HEAD^';
} else if (tryGit('rev-parse', '--verify', 'origin/main')) {
  baseSha = tryGit('merge-base', 'origin/main', 'HEAD');
  baseSource = 'merge-base(origin/main)';
}

let commitsSinceBase = 0;
let commitsWithTrailers = 0;
if (baseSha) {
  const range = `${baseSha}..${headSha}`;
  const shas = tryGit('rev-list', range).split('\n').filter(Boolean);
  commitsSinceBase = shas.length;
  for (const sha of shas) {
    const trailers = parseTrailers(sha);
    if (REQUIRED_TRAILERS.every(([, key]) => trailers[key])) commitsWithTrailers += 1;
  }
}

const headTrailers = parseTrailers(headSha);
const present = [];
const missing = [];
const values = {};
for (const [field, key] of REQUIRED_TRAILERS) {
  const value = headTrailers[key] || '';
  values[field] = value;
  (value ? present : missing).push(key);
}

const hasBaseTrailer = Boolean(headTrailers['Base-SHA']);
if (hasBaseTrailer) values.base_sha_declared = headTrailers['Base-SHA'];

const provenance = {
  schema: 'syndes.provenance/1',
  head_sha: headSha,
  base_sha: baseSha,
  base_source: baseSource,
  branch: process.env.GITHUB_REF_NAME || tryGit('rev-parse', '--abbrev-ref', 'HEAD'),
  event: eventName,
  actor: process.env.GITHUB_ACTOR || '',
  commit: {
    subject: tryGit('log', '-1', '--format=%s', headSha),
    author_name: tryGit('log', '-1', '--format=%an', headSha),
    author_email: tryGit('log', '-1', '--format=%ae', headSha),
    authored_at: tryGit('log', '-1', '--format=%aI', headSha),
  },
  commits_since_base: commitsSinceBase,
  commits_with_trailers: commitsWithTrailers,
  trailers: {
    head: values,
    present,
    missing,
    complete: missing.length === 0,
  },
};

writeFileSync('provenance.json', `${JSON.stringify(provenance, null, 2)}\n`);

const summaryLine = provenance.trailers.complete
  ? `provenance: ${present.length}/${REQUIRED_TRAILERS.length} trailers present`
  : `provenance: missing ${missing.join(', ')}`;
console.log(summaryLine);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Provenance\n\n- head: \`${headSha}\`\n- base: \`${baseSha || 'n/a'}\` (${baseSource || 'n/a'})\n- ${summaryLine}\n`,
  );
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `provenance=${JSON.stringify(provenance)}\n`);
}
