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
  UseGuards,
} from '@nestjs/common';
import { envelope, verifyBearerToken } from '@elyvion/shared';
import { OperatorTokenGuard } from '../authorization/operator-token.guard';
import { AccountsService } from './accounts.service';
import {
  bootstrapTenantSchema,
  registerUserSchema,
  tenantMemberSchema,
  updateUserSchema,
  verifyCredentialsSchema,
} from './dto/accounts.dto';
import { SecurityInternalTokenGuard } from './security-internal-token.guard';

@Controller()
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const parsed = registerUserSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.accounts.register(parsed.data));
  }

  @Post('internal/users/verify-credentials')
  @UseGuards(SecurityInternalTokenGuard)
  async verifyCredentials(@Body() body: unknown) {
    const parsed = verifyCredentialsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.accounts.verifyCredentials(parsed.data));
  }

  @Get('internal/users/by-id/:id')
  @UseGuards(SecurityInternalTokenGuard)
  async findById(@Param('id') id: string) {
    return envelope(await this.accounts.findById(id));
  }

  @Get('users')
  @UseGuards(OperatorTokenGuard)
  async findAll() {
    return envelope(await this.accounts.findAll());
  }

  @Patch('users/by-id/:id')
  @UseGuards(OperatorTokenGuard)
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.accounts.update(id, parsed.data));
  }

  @Delete('users/by-id/:id')
  @HttpCode(204)
  @UseGuards(OperatorTokenGuard)
  async remove(@Param('id') id: string) {
    await this.accounts.remove(id);
  }

  @Get('tenant-membership')
  async checkTenantMembership(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-tenant-id') tenantId: string | undefined,
  ) {
    if (!tenantId?.trim()) throw new BadRequestException('x-tenant-id is required.');
    const payload = await verifyRequestToken(authorization);
    if (!payload.sub) throw new UnauthorizedException('Token has no subject.');
    if (!(await this.accounts.hasActiveMembership(payload.sub, tenantId))) {
      throw new ForbiddenException('No active membership in this tenant.');
    }
    return envelope({ userId: payload.sub, tenantId });
  }

  @Get('tenants/mine')
  async listMyTenants(@Headers('authorization') authorization: string | undefined) {
    const payload = await verifyRequestToken(authorization);
    if (!payload.sub) throw new UnauthorizedException('Token has no subject.');
    return envelope(await this.accounts.listActiveTenants(payload.sub));
  }

  @Post('operator/tenants/bootstrap')
  @UseGuards(OperatorTokenGuard)
  async bootstrapTenant(@Body() body: unknown) {
    const parsed = bootstrapTenantSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.accounts.bootstrapTenant(parsed.data.name, parsed.data.adminEmail));
  }

  @Post('operator/tenants/:tenantId/members')
  @UseGuards(OperatorTokenGuard)
  async addTenantMember(@Param('tenantId') tenantId: string, @Body() body: unknown) {
    const parsed = tenantMemberSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.accounts.addTenantMember(tenantId, parsed.data.email));
  }
}

async function verifyRequestToken(authorization: string | undefined) {
  try {
    return await verifyBearerToken(
      authorization,
      process.env.AUTH_ISSUER_URL ?? 'http://localhost:3011',
      process.env.API_AUDIENCE ?? 'elyvion:api',
      process.env.AUTH_JWKS_URL,
    );
  } catch {
    throw new UnauthorizedException('Invalid or expired token.');
  }
}
