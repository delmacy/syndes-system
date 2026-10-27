import {
  ControlPlaneConfigurationError,
  resolveControlPlaneDatabaseUrl,
  resolveTenantAdminDatabaseUrl,
  TenantAdminDatabaseConfigurationError,
} from './control-plane-database.provider';

describe('Control Plane database configuration', () => {
  it('requires its own URL', () => {
    expect(() => resolveControlPlaneDatabaseUrl({})).toThrow(
      new ControlPlaneConfigurationError('CONTROL_PLANE_DATABASE_URL'),
    );
  });

  it('requires a separate tenant admin URL instead of falling back to Control Plane', () => {
    expect(() =>
      resolveTenantAdminDatabaseUrl({
        CONTROL_PLANE_DATABASE_URL: 'postgresql://cp-test.invalid/control',
      }),
    ).toThrow(TenantAdminDatabaseConfigurationError);
  });

  it('resolves the tenant admin URL only from its dedicated setting', () => {
    expect(
      resolveTenantAdminDatabaseUrl({
        CONTROL_PLANE_DATABASE_URL: 'postgresql://cp-test.invalid/control',
        TENANT_ADMIN_DATABASE_URL: 'postgresql://admin-test.invalid/admin',
      }),
    ).toBe('postgresql://admin-test.invalid/admin');
  });
});
