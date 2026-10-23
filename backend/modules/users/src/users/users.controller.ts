import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { envelope } from '@elyvion/shared';
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
  async verifyCredentials(@Body() body: unknown) {
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
  async findById(@Param('id') id: string) {
    return envelope(await this.usersService.findById(id));
  }

  /** Admin use. */
  @Get()
  async findAll() {
    return envelope(await this.usersService.findAll());
  }

  /** Admin use. */
  @Patch('by-id/:id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.usersService.update(id, parsed.data));
  }

  /** Admin use. */
  @Delete('by-id/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
  }
}
