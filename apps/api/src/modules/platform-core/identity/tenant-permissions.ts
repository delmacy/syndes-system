import { ForbiddenException } from '@nestjs/common';
import type { TenantContext } from './identity.contracts';

export type TenantAction =
  'read' | 'create' | 'update' | 'archive' | 'export' | 'manage_members';

const MEMBER_ACTIONS = new Set<TenantAction>(['read', 'create', 'update']);

export function assertTenantAction(
  context: TenantContext,
  action: TenantAction,
): void {
  if (context.role === 'tenant_admin') return;
  if (context.role !== 'tenant_member' || !MEMBER_ACTIONS.has(action))
    throw new ForbiddenException();
}

export function allowsCustomerScope(
  context: TenantContext,
  scope: 'cpf' | 'pj',
): boolean {
  return context.customerScope === 'both' || context.customerScope === scope;
}
