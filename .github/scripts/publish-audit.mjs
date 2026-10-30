#!/usr/bin/env node
// Publica o veredito da auditoria: commit status (check obrigatório) e
// comentário idempotente no PR. Nada aqui altera o resultado dos gates — o
// manifesto já foi calculado; este script só o torna visível.
import { existsSync, readFileSync } from 'node:fs';

const env = process.env;
const token = env.GITHUB_TOKEN;
const repo = env.GITHUB_REPOSITORY;
const apiUrl = env.GITHUB_API_URL || 'https://api.github.com';
const manifestPath = 'audit-manifest.json';

if (!existsSync(manifestPath)) {
  console.error('audit-manifest.json not found');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const digest = existsSync('audit-manifest.sha256')
  ? readFileSync('audit-manifest.sha256', 'utf8').trim().split(/\s+/)[0]
  : '';

if (!token || !repo) {
  console.error('GITHUB_TOKEN and GITHUB_REPOSITORY are required');
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

const passed = manifest.verdict === 'pass';
const gateSummary = manifest.gates
  .map((gate) => `${gate.name}=${gate.conclusion}`)
  .join('; ');
const description = [
  passed ? 'all gates passed' : `failed: ${manifest.gates.filter((g) => !g.passed).map((g) => g.id).join(',') || 'none'}`,
  manifest.agent.trailers_complete
    ? `provenance ${manifest.agent.trailers_present.length}/3`
    : 'provenance incomplete',
  digest ? `sha256:${digest.slice(0, 12)}` : '',
]
  .filter(Boolean)
  .join(' | ')
  .slice(0, 140);

const targetUrl = manifest.workflow.url || '';

async function publishStatus() {
  const sha = manifest.commit.head_sha;
  if (!sha) throw new Error('head_sha missing');
  await api('POST', `/repos/${repo}/statuses/${sha}`, {
    state: passed ? 'success' : 'failure',
    context: 'agent-ci/audit',
    description,
    target_url: targetUrl,
  });
  console.log(`status agent-ci/audit=${passed ? 'success' : 'failure'} on ${sha}`);
}

function renderComment() {
  const marker = '<!-- agent-ci-audit -->';
  const icon = passed ? '✅' : '❌';
  const gateRows = manifest.gates
    .map((gate) => `| ${gate.name} | ${gate.conclusion} | ${gate.duration_seconds ?? 'n/a'}s |`)
    .join('\n');
  const warnings = manifest.warnings.length
    ? `\n**Avisos**\n${manifest.warnings.map((w) => `- \`${w}\``).join('\n')}\n`
    : '';
  const attribution = manifest.agent.trailers_complete
    ? `**Atribuição:** agente \`${manifest.agent.agent}\`, worktree \`${manifest.agent.worktree}\`, sessão \`${manifest.agent.session}\``
    : `**Atribuição:** incompleta (faltam ${manifest.agent.trailers_missing.map((t) => `\`${t}\``).join(', ')})`;

  return [
    marker,
    `## ${icon} CI audit — veredito \`${manifest.verdict}\``,
    '',
    `| | |`,
    '| --- | --- |',
    `| head | \`${manifest.commit.head_sha}\` |`,
    `| base | \`${manifest.commit.base_sha || 'n/a'}\` (${manifest.commit.base_source || 'n/a'}) |`,
    `| commits no intervalo | ${manifest.commit.commits_since_base ?? 'n/a'} (${manifest.commit.commits_with_trailers ?? 0} com trailers) |`,
    `| run | ${targetUrl || 'n/a'} |`,
    `| manifest sha256 | \`${digest || 'n/a'}\` |`,
    '',
    attribution,
    '',
    '| Gate | Conclusion | Duration |',
    '| --- | --- | --- |',
    gateRows || '| _(nenhum)_ | n/a | n/a |',
    warnings,
    '<sub>Gerado por `.github/workflows/agent-ci-audit.yml`. O manifesto é anexado como artifact imutável deste run.</sub>',
  ].join('\n');
}

async function publishComment() {
  const number = Number(env.PR_NUMBER || '');
  if (!Number.isInteger(number) || number <= 0) {
    console.log('no PR number on this event; skipping comment');
    return;
  }
  const body = renderComment();
  const comments = await api('GET', `/repos/${repo}/issues/${number}/comments?per_page=100`);
  const existing = (comments || []).find((c) => (c.body || '').includes('<!-- agent-ci-audit -->'));
  if (existing) {
    await api('PATCH', `/repos/${repo}/issues/comments/${existing.id}`, { body });
    console.log(`comment updated: ${existing.html_url}`);
  } else {
    const created = await api('POST', `/repos/${repo}/issues/${number}/comments`, { body });
    console.log(`comment created: ${created.html_url}`);
  }
}

await publishStatus();
await publishComment();
