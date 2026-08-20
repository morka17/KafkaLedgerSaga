import { Body, Controller, ForbiddenException, HttpCode, Post } from '@nestjs/common';
import { IsEmail, IsUUID } from 'class-validator';
import { JwtService } from '@nestjs/jwt';

class DevTokenDto {
  @IsUUID()
  customerId!: string;

  @IsEmail()
  email!: string;
}

/**
 * Local-dev-only convenience endpoint that issues a real, correctly signed
 * JWT for a given customerId, so `curl` and the seed data in
 * tools/scripts/seed-dev-data.ts can exercise the full checkout flow
 * without standing up a separate identity provider.
 *
 * Refuses to run outside development - in staging/production, tokens come
 * from the real identity provider and this controller is dead code that
 * never gets registered (see AuthModule).
 */
@Controller('auth')
export class DevTokenController {
  constructor(private readonly jwtService: JwtService) {}

  @Post('dev-token')
  @HttpCode(200)
  issue(@Body() dto: DevTokenDto): { accessToken: string } {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Dev token issuance is disabled in production.');
    }
    const accessToken = this.jwtService.sign({
      sub: dto.customerId,
      email: dto.email,
      roles: ['customer'],
    });
    return { accessToken };
  }
}
