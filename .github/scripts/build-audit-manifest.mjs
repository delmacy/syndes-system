#!/usr/bin/env node
// Monta o manifesto auditável de um run de CI a partir das evidências que o
// próprio GitHub produziu: conclusão dos jobs, SHA de base e de topo, trailers
// de procedência e duração reportada pela API de Actions.
//
// Entrada (env):
//   GATES           JSON: [{"id":"...","name":"...","result":"success"}]
//   REQUIRE_TRAILERS "true" | "false"
//   AUDIT_GATES_JSON opcional: saída de /actions/runs/{id}/jobs para durações
//
// Saída: audit-manifest.json, audit-manifest.sha256 e resumo em $GITHUB_STEP_SUMMARY
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const env = process.env;

function parseJson(text, fallback) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

const gates = parseJson(env.GATES, []);
const provenance = parseJson(
  existsSync('provenance.json') ? readFileSync('provenance.json', 'utf8') : '',
  {},
);

// Durações vêm da API de Actions, não de instrumentação no workflow: é evidência
// que o próprio GitHub registrou.
const durations = new Map();
const jobsFile = env.AUDIT_JOBS_FILE || 'jobs.json';
const jobsPayload = existsSync(jobsFile)
  ? parseJson(readFileSync(jobsFile, 'utf8'), { jobs: [] })
  : { jobs: [] };
for (const job of jobsPayload.jobs || []) {
  if (!job.name) continue;
  const start = job.started_at ? Date.parse(job.started_at) : NaN;
  const end = job.completed_at ? Date.parse(job.completed_at) : NaN;
  if (Number.isFinite(start) && Number.isFinite(end)) {
    durations.set(job.name, Math.round(((end - start) / 1000) * 10) / 10);
  }
}

const requireTrailers = String(env.REQUIRE_TRAILERS || 'false').toLowerCase() === 'true';
const warnings = [];

const gateRecords = gates.map((gate) => ({
  id: gate.id,
  name: gate.name,
  conclusion: gate.result,
  passed: gate.result === 'success',
  duration_seconds: durations.get(gate.job_name || gate.name) ?? null,
}));

const failedGates = gateRecords.filter((gate) => !gate.passed).map((gate) => gate.id);
const gatesPassed = gateRecords.length > 0 && failedGates.length === 0;

if (gateRecords.length === 0) warnings.push('no-gates-recorded');

const trailers = provenance.trailers || { complete: false, missing: ['unknown'], present: [] };
if (!trailers.complete) {
  const message = `provenance-incomplete:${(trailers.missing || []).join(',')}`;
  if (requireTrailers) {
    warnings.push(message);
  } else {
    warnings.push(`${message} (advisory)`);
  }
}

const verdict = gatesPassed && !(requireTrailers && !trailers.complete) ? 'pass' : 'fail';

// Tratamento da frota Orca.
//
// Fonte preferida: commit status `orca-fleet/audit`, publicado pelo host que tem
// a frota (o Orca local). Um arquivo dentro do commit nao serve como fonte
// primaria: o registro precisaria conter o SHA do proprio commit que o contem,
// o que e impossivel. O status e publicado depois que o SHA existe, e fica
// vinculado a ele pela propria API.
//
// A descricao do status tem formato estavel e limitado a 140 chars:
//   w10 rel5 leak0 pin0/10 churn306 sha:86b79918
// Checks API nao e usada: exige GitHub App, e o token disponivel e OAuth.
const headSha = provenance.head_sha || env.GITHUB_SHA || '';

function parseFleetDescription(text) {
  const re = /w(\d+) rel(\d+) leak(\d+) pin(\d+)\/(\d+) churn(\d+) sha:([0-9a-f]{8})/i;
  const hit = re.exec(text || '');
  if (!hit) return null;
  const [, w, rel, leak, pin, total, churn, digest] = hit;
  return {
    workers: Number(w),
    released: Number(rel),
    retained_actionable: Number(leak),
    model_pinned: Number(pin),
    model_unpinned: Number(total) - Number(pin),
    coordinator_churn: Number(churn),
    ledger_digest_prefix: digest,
  };
}

let statusInfo = null;
const statusFile = env.AUDIT_FLEET_STATUS_FILE || 'fleet-status.json';
if (existsSync(statusFile)) {
  const list = parseJson(readFileSync(statusFile, 'utf8'), []);
  const rows = Array.isArray(list) ? list : [];
  statusInfo = rows.find((s) => s.context === 'orca-fleet/audit') || null;
}

let fleetDoc = null;
let fleetSource = null;
let orchestration = { present: false };

if (statusInfo) {
  const parsed = parseFleetDescription(statusInfo.description);
  orchestration = {
    present: true,
    source: 'commit-status',
    status_state: statusInfo.state,
    description: statusInfo.description,
    workers: parsed?.workers ?? null,
    released: parsed?.released ?? null,
    retained_actionable: parsed?.retained_actionable ?? null,
    model_pinned: parsed?.model_pinned ?? null,
    model_unpinned: parsed?.model_unpinned ?? null,
    coordinator_churn: parsed?.coordinator_churn ?? null,
    ledger_digest_prefix: parsed?.ledger_digest_prefix ?? null,
    problems: parsed ? [] : ['status-unparsable'],
  };
  if (!parsed) warnings.push('fleet-status:unparsable');
  if (statusInfo.state === 'failure') warnings.push('fleet-status:failure');
} else if (headSha && existsSync(`.audit/fleet/${headSha}.json`)) {
  // Fallback historico: registro versionado no proprio commit.
  try {
    fleetDoc = JSON.parse(readFileSync(`.audit/fleet/${headSha}.json`, 'utf8'));
    fleetSource = 'commit-file';
  } catch {
    fleetDoc = null;
  }
  if (fleetDoc) {
    const problems = [];
    if (fleetDoc.schema !== 'syndes.fleet-audit/1') problems.push('schema-mismatch');
    if (fleetDoc.scope?.commit_sha !== headSha) problems.push('sha-mismatch');
    const lc = fleetDoc.lifecycle || {};
    orchestration = {
      present: true,
      source: fleetSource,
      schema: fleetDoc.schema ?? null,
      run_id: fleetDoc.scope?.run_id ?? null,
      branch: fleetDoc.scope?.branch ?? null,
      workers: lc.workers ?? null,
      settled: lc.settled ?? null,
      released: lc.released ?? null,
      retained_actionable: lc.retained_actionable ?? null,
      external_residue: lc.external_residue ?? null,
      model_pinned: lc.model_pinned ?? null,
      model_unpinned: lc.model_unpinned ?? null,
      avg_duration_seconds: lc.avg_duration_seconds ?? null,
      coordinator_churn: fleetDoc.run?.coordinator_churn ?? null,
      ledger_digest: fleetDoc.evidence?.sha256 ?? null,
      problems,
    };
    if (problems.length) warnings.push(`fleet-evidence:${problems.join(',')}`);
    if ((lc.retained_actionable ?? 0) > 0) warnings.push(`fleet-leak:${lc.retained_actionable}`);
  }
}

// Interruptor unico de enforcement da frota. Enquanto "false", vazamento e
// evidencia e vira aviso; quando "true", reprova o run. Virar e mudar uma linha
// de env no workflow -- nenhuma outra alteracao de desenho e necessaria.
const fleetEnforce = String(env.FLEET_ENFORCE || 'false').toLowerCase() === 'true';
let finalVerdict = verdict;
if (fleetEnforce) {
  warnings.push('fleet-enforcement-active');
  if (orchestration.status_state === 'failure') {
    finalVerdict = 'fail';
    warnings.push('fleet-enforced');
  }
}

const workflowName = env.GITHUB_WORKFLOW || 'agent-ci-audit';
const runUrl =
  env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
    ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
    : '';

const manifest = {
  schema: 'syndes.ci-audit/1',
  generated_at: new Date().toISOString(),
  repository: env.GITHUB_REPOSITORY || '',
  workflow: { name: workflowName, run_id: env.GITHUB_RUN_ID || '', attempt: env.GITHUB_RUN_ATTEMPT || '', url: runUrl },
  trigger: {
    event: provenance.event || env.GITHUB_EVENT_NAME || '',
    actor: provenance.actor || env.GITHUB_ACTOR || '',
    ref: env.GITHUB_REF || '',
    branch: provenance.branch || '',
  },
  commit: {
    head_sha: provenance.head_sha || env.GITHUB_SHA || '',
    base_sha: provenance.base_sha || '',
    base_source: provenance.base_source || '',
    subject: provenance.commit?.subject || '',
    author: {
      name: provenance.commit?.author_name || '',
      email: provenance.commit?.author_email || '',
      authored_at: provenance.commit?.authored_at || '',
    },
    commits_since_base: provenance.commits_since_base ?? null,
    commits_with_trailers: provenance.commits_with_trailers ?? null,
  },
  agent: {
    worktree: provenance.trailers?.head?.worktree || '',
    agent: provenance.trailers?.head?.agent || '',
    session: provenance.trailers?.head?.session || '',
    base_sha_declared: provenance.trailers?.head?.base_sha_declared || '',
    trailers_present: trailers.present || [],
    trailers_missing: trailers.missing || [],
    trailers_complete: Boolean(trailers.complete),
    trailers_required: requireTrailers,
  },
  gates: gateRecords,
  orchestration,
  verdict: finalVerdict,
  warnings,
};

const json = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync('audit-manifest.json', json);
const digest = createHash('sha256').update(json).digest('hex');
writeFileSync('audit-manifest.sha256', `${digest}  audit-manifest.json\n`);

console.log(`verdict: ${finalVerdict}`);
console.log(`manifest sha256: ${digest}`);
if (warnings.length) console.log(`warnings: ${warnings.join(' | ')}`);

if (env.GITHUB_STEP_SUMMARY) {
  const rows = gateRecords
    .map((gate) => `| ${gate.name} | ${gate.conclusion} | ${gate.duration_seconds ?? 'n/a'}s |`)
    .join('\n');
  appendFileSync(
    env.GITHUB_STEP_SUMMARY,
    [
      '## CI audit',
      '',
      `- verdict: **${finalVerdict}**`,
      `- head: \`${manifest.commit.head_sha}\``,
      `- base: \`${manifest.commit.base_sha || 'n/a'}\``,
      `- agent: \`${manifest.agent.agent || 'n/a'}\` worktree \`${manifest.agent.worktree || 'n/a'}\``,
      `- manifest sha256: \`${digest}\``,
      '',
      '| Gate | Conclusion | Duration |',
      '| --- | --- | --- |',
      rows,
      '',
    ].join('\n'),
  );
}
