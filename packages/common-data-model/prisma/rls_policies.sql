-- Row-Level Security for the control-plane tables. Apply after `prisma migrate deploy`.
--
-- The API sets `app.tenant_id` for the lifetime of each request/transaction
-- (apps/api/src/common/prisma-tenant.middleware.ts) via `SET LOCAL app.tenant_id = '<uuid>'`,
-- so these policies make cross-tenant reads/writes impossible even if a bug in application code
-- forgets a WHERE tenant_id = ... clause.
--
-- A separate, more privileged role (`rwe_platform_admin`) bypasses RLS for platform-operator
-- reporting/support tooling; it must be used only from audited, break-glass tooling, never from
-- the primary application connection pool.

ALTER TABLE tenant           ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_user         ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_record   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsar_request     ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription     ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_record     ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tenant ON tenant
  USING (id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_app_user ON app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_consent_record ON consent_record
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- audit_log: readable only within the tenant scope, and insert-only (no UPDATE/DELETE policy
-- exists at all, so those statements fail regardless of role, short of the break-glass admin role).
CREATE POLICY tenant_isolation_audit_log_select ON audit_log
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_audit_log_insert ON audit_log
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_dsar_request ON dsar_request
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_connector_config ON connector_config
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_subscription ON subscription
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_usage_record ON usage_record
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Revoke UPDATE/DELETE on audit_log from the application role entirely, belt-and-suspenders
-- alongside the RLS policy above (adjust role name to match your deployment).
-- REVOKE UPDATE, DELETE ON audit_log FROM rwe_app;
