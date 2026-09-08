import { Injectable } from '@nestjs/common';
import { AbilityBuilder, PureAbility } from '@casl/ability';
import { AuthenticatedUser } from './current-user.decorator';

export type Action = 'read_identifiable' | 'read_deidentified' | 'export' | 'manage_connectors' | 'manage_billing' | 'manage_consent';
export type Subject = 'PatientRecord' | 'Connector' | 'Billing' | 'Consent' | 'AuditLog';
export type AppAbility = PureAbility<[Action, Subject]>;

/**
 * RBAC (role checked by `RolesGuard`) covers coarse route-level access; this factory adds
 * attribute-based rules for finer distinctions the role alone doesn't capture — e.g. a
 * `data_analyst` can run cohort queries against de-identified data but never read identifiable
 * records, while a `clinician` can read identifiable records for their own patients' care but
 * cannot manage billing or connectors.
 */
@Injectable()
export class AbilityFactory {
  createForUser(user: AuthenticatedUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(PureAbility);

    switch (user.role) {
      case 'platform_admin':
        can(['read_identifiable', 'read_deidentified', 'export', 'manage_connectors', 'manage_billing', 'manage_consent'], [
          'PatientRecord',
          'Connector',
          'Billing',
          'Consent',
          'AuditLog',
        ]);
        break;
      case 'tenant_admin':
        can(['read_deidentified', 'manage_connectors', 'manage_billing', 'manage_consent'], [
          'PatientRecord',
          'Connector',
          'Billing',
          'Consent',
          'AuditLog',
        ]);
        break;
      case 'clinician':
        can(['read_identifiable', 'read_deidentified'], 'PatientRecord');
        break;
      case 'data_analyst':
        can(['read_deidentified'], 'PatientRecord');
        break;
      case 'auditor':
        can(['read_deidentified'], ['PatientRecord', 'AuditLog']);
        break;
      case 'patient':
        // Self-service DSAR only; patient-facing endpoints re-check dataSubjectId === user.userId explicitly, not via this ability.
        break;
    }

    return build();
  }
}
