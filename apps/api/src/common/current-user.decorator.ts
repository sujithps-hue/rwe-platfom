import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RoleName } from '@rwe/common-data-model';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  role: RoleName;
  email: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
