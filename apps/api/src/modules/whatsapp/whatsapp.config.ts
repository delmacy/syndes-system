import { validationProblem } from '../core-crm/crm-problem-details';

export const WHATSAPP_CONFIG = 'WHATSAPP_CONFIG';

export interface WhatsAppConfig {
  enabled: boolean;
  bindHost: string;
  port: number;
  webhookPath: string;
  provider: 'fake' | 'whatsmeow';
  whatsmeowUrl: string | null;
  whatsmeowToken: string | null;
  webhookToken: string | null;
  requestTimeoutMs: number;
  publicBaseUrl: string | null;
  maxConnectionsPerTenant: 1;
}

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  if (value === '1' || value.toLowerCase() === 'true') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  throw validationProblem([
    { field: 'WHATSAPP_ENABLED', rule: 'invalid_value' },
  ]);
}

export function readWhatsAppConfig(env: NodeJS.ProcessEnv): WhatsAppConfig {
  const port = Number(env.WHATSAPP_PORT ?? '18083');
  const enabled = bool(env.WHATSAPP_ENABLED);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw validationProblem([
      { field: 'WHATSAPP_PORT', rule: 'invalid_value' },
    ]);
  }
  const webhookPath =
    env.WHATSAPP_WEBHOOK_PATH?.trim() || '/api/v1/whatsapp/webhook';
  if (!webhookPath.startsWith('/')) {
    throw validationProblem([
      { field: 'WHATSAPP_WEBHOOK_PATH', rule: 'invalid_value' },
    ]);
  }
  const provider = (env.WHATSAPP_PROVIDER?.trim() ||
    'whatsmeow') as WhatsAppConfig['provider'];
  if (provider !== 'fake' && provider !== 'whatsmeow') {
    throw validationProblem([
      { field: 'WHATSAPP_PROVIDER', rule: 'invalid_value' },
    ]);
  }
  const publicBaseUrl = env.WHATSAPP_PUBLIC_BASE_URL?.trim() || null;
  if (publicBaseUrl && !/^https:\/\//i.test(publicBaseUrl)) {
    throw validationProblem([
      { field: 'WHATSAPP_PUBLIC_BASE_URL', rule: 'invalid_value' },
    ]);
  }
  const whatsmeowUrl =
    env.WHATSAPP_WHATSMEOW_URL?.trim().replace(/\/$/, '') || null;
  if (
    enabled &&
    provider === 'whatsmeow' &&
    (!whatsmeowUrl || !/^https?:\/\//i.test(whatsmeowUrl))
  ) {
    throw validationProblem([
      { field: 'WHATSAPP_WHATSMEOW_URL', rule: 'required' },
    ]);
  }
  const requestTimeoutMs = Number(env.WHATSAPP_REQUEST_TIMEOUT_MS ?? '10000');
  if (
    !Number.isInteger(requestTimeoutMs) ||
    requestTimeoutMs < 1000 ||
    requestTimeoutMs > 60000
  ) {
    throw validationProblem([
      { field: 'WHATSAPP_REQUEST_TIMEOUT_MS', rule: 'invalid_value' },
    ]);
  }
  const webhookToken = env.WHATSAPP_WEBHOOK_TOKEN?.trim() || null;
  if (enabled && !webhookToken) {
    throw validationProblem([
      { field: 'WHATSAPP_WEBHOOK_TOKEN', rule: 'required' },
    ]);
  }
  return {
    enabled,
    bindHost: env.WHATSAPP_BIND_HOST?.trim() || '127.0.0.1',
    port,
    webhookPath,
    provider,
    whatsmeowUrl,
    whatsmeowToken: env.WHATSAPP_WHATSMEOW_TOKEN?.trim() || null,
    webhookToken,
    requestTimeoutMs,
    publicBaseUrl,
    maxConnectionsPerTenant: 1,
  };
}
