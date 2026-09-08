import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditAction } from '@rwe/compliance-engine';
import { AuditLogger } from '@rwe/compliance-engine';
import { PrismaAuditSink } from './prisma-audit-sink';
import { getTenantContext } from './tenant-context';

export const AUDIT_ACTION_KEY = 'auditAction';
export const AuditableAction = (action: AuditAction, resourceType: string) =>
  SetMetadata(AUDIT_ACTION_KEY, { action, resourceType });

/**
 * Writes an audit_log row for any route annotated with `@AuditableAction(...)`, after a
 * successful response. This is the mechanism behind docs/COMPLIANCE.md's "every read of
 * identifiable health data, every export, every consent or connector change is written to an
 * append-only audit log" guarantee — annotate the controller method, not remember to call the
 * logger manually inside every handler.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditSink: PrismaAuditSink,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<{ action: AuditAction; resourceType: string } | undefined>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      tap((result) => {
        const tenantCtx = getTenantContext();
        const logger = new AuditLogger(this.auditSink);
        void logger.log({
          tenantId: tenantCtx.tenant.id,
          actorId: user?.userId ?? 'anonymous',
          actorRole: user?.role ?? 'unknown',
          action: meta.action,
          jurisdiction: tenantCtx.tenant.jurisdictions[0] ?? 'GLOBAL',
          resourceType: meta.resourceType,
          resourceId: (result as { id?: string } | undefined)?.id,
        });
      }),
    );
  }
}
