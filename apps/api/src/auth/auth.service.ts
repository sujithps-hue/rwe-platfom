import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { AuthenticatedUser } from '../common/current-user.decorator';

/**
 * Minimal password-less login stub for local dev/demo: issues a JWT for a known user by
 * email+tenant. Production deployments replace this with real SSO (SAML/OIDC — see
 * docs/MULTI_TENANCY.md's enterprise-tier "SSO/SCIM" mention) or an actual password/MFA flow;
 * the JWT shape and downstream guards don't change either way.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async loginDevOnly(tenantId: string, email: string): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findFirst({ where: { tenantId, email } });
    if (!user) throw new UnauthorizedException('Unknown user for this tenant');

    const payload: AuthenticatedUser = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role as AuthenticatedUser['role'],
      email: user.email,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken };
  }
}
