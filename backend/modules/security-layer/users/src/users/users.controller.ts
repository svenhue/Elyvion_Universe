import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { envelope, verifyBearerToken } from '@elyvion/shared';
import { timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { z } from 'zod';
import { UsersService } from './users.service';
import { registerUserSchema, updateUserSchema, verifyCredentialsSchema } from './dto/users.dto';

/**
 * Mounted at root (not @Controller('users')) — the Gateway already
 * namespaces this module's traffic under /api/users/..., so a second
 * "users" prefix here would double up (and break the direct,
 * non-gateway calls modules/auth makes to this service).
 */
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Public (allowlisted at the Gateway — see modules/gateway's
   * PUBLIC_ROUTES): the only endpoint on this module a browser may
   * call without a Bearer token, since a new user has none yet.
   */
  @Post('register')
  async register(@Body() body: unknown) {
    const parsed = registerUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.usersService.register(parsed.data));
  }

  /**
   * Internal — called directly by modules/auth during the OIDC login
   * interaction, never routed through the Gateway.
   */
  @Post('verify-credentials')
  async verifyCredentials(
    @Body() body: unknown,
    @Headers('x-users-service-token') serviceToken: string | undefined,
  ) {
    assertServiceToken(serviceToken);
    const parsed = verifyCredentialsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.usersService.verifyCredentials(parsed.data));
  }

  /**
   * Internal — used by modules/auth's findAccount() to build OIDC claims.
   * Namespaced under `by-id/` so this root-mounted controller's GET route
   * can't accidentally shadow another controller's static path (e.g.
   * RolesController's `/roles`) the way a bare `/:id` would.
   */
  @Get('by-id/:id')
  async findById(
    @Param('id') id: string,
    @Req() request: Request,
    @Headers('x-users-service-token') serviceToken: string | undefined,
  ) {
    if (!isValidOperatorToken(serviceToken, process.env.USERS_SERVICE_TOKEN)) {
      const payload = await verifyRequestToken(request.headers.authorization);
      if (payload.sub !== id) throw new ForbiddenException('You can only read your own account');
    }
    return envelope(await this.usersService.findById(id));
  }

  /** Admin use. */
  @Get()
  async findAll(@Headers('x-operator-token') operatorToken: string | undefined) {
    assertOperatorToken(operatorToken);
    return envelope(await this.usersService.findAll());
  }

  /** Admin use. */
  @Patch('by-id/:id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('x-operator-token') operatorToken: string | undefined,
  ) {
    assertOperatorToken(operatorToken);
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.usersService.update(id, parsed.data));
  }

  /** Admin use. */
  @Delete('by-id/:id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @Headers('x-operator-token') operatorToken: string | undefined,
  ) {
    assertOperatorToken(operatorToken);
    await this.usersService.remove(id);
  }

  @Get('tenant-membership')
  async checkTenantMembership(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-tenant-id') tenantId: string | undefined,
  ) {
    if (!tenantId?.trim()) throw new BadRequestException('x-tenant-id is required');
    const payload = await verifyRequestToken(authorization);
    const subjectId = payload.sub;
    if (!subjectId) throw new UnauthorizedException('Token has no subject');
    if (!(await this.usersService.hasActiveMembership(subjectId, tenantId))) {
      throw new ForbiddenException('No active membership in this tenant');
    }
    return envelope({ userId: subjectId, tenantId });
  }

  @Post('operator/tenants/bootstrap')
  async bootstrapTenant(
    @Headers('x-operator-token') operatorToken: string | undefined,
    @Body() body: unknown,
  ) {
    assertOperatorToken(operatorToken);
    const parsed = bootstrapTenantSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.usersService.bootstrapTenant(parsed.data.name, parsed.data.adminEmail));
  }

  @Post('operator/tenants/:tenantId/members')
  async addTenantMember(
    @Headers('x-operator-token') operatorToken: string | undefined,
    @Param('tenantId') tenantId: string,
    @Body() body: unknown,
  ) {
    assertOperatorToken(operatorToken);
    const parsed = tenantMemberSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.usersService.addTenantMember(tenantId, parsed.data.email));
  }
}

const bootstrapTenantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  adminEmail: z.string().email(),
});

const tenantMemberSchema = z.object({ email: z.string().email() });

function assertOperatorToken(provided: string | undefined): void {
  if (!isValidOperatorToken(provided, process.env.TENANT_BOOTSTRAP_TOKEN)) {
    throw new UnauthorizedException('Invalid or missing operator token');
  }
}

function assertServiceToken(provided: string | undefined): void {
  if (!isValidOperatorToken(provided, process.env.USERS_SERVICE_TOKEN)) {
    throw new UnauthorizedException('Invalid or missing users-service token');
  }
}

function isValidOperatorToken(provided: string | undefined, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  const actualBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

async function verifyRequestToken(authorization: string | undefined) {
  try {
    return await verifyBearerToken(
      authorization,
      process.env.AUTH_ISSUER_URL ?? 'http://localhost:3011',
      process.env.API_AUDIENCE ?? 'elyvion:api',
    );
  } catch {
    throw new UnauthorizedException('Invalid or expired token');
  }
}
