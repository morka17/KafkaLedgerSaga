import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '@saganova/common';

interface JwtClaims {
  sub: string;
  email: string;
  roles?: string[];
}

/**
 * Validates the bearer token on every guarded request. Signature/expiry
 * verification happens automatically via `secretOrKey` before `validate()`
 * is even called - this method only shapes the claims into the
 * AuthenticatedUser the rest of the app (via @CurrentUser()) relies on.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET must be set - refusing to boot with no signing secret.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtClaims): AuthenticatedUser {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Malformed token claims');
    }
    return { id: payload.sub, email: payload.email, roles: payload.roles ?? [] };
  }
}
