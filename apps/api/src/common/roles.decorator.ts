import { SetMetadata } from '@nestjs/common';
import { RoleName } from '@rwe/common-data-model';

export const ROLES_KEY = 'roles';

/** Restricts a route to the listed roles. Enforced by `RolesGuard`. */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
