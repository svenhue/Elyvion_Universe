import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { ModulesService } from './modules.service';
import { registerModuleSchema } from './register-module.dto';

@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const parsed = registerModuleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    const module = await this.modulesService.register(parsed.data);
    return envelope(module);
  }

  @Get()
  async findAll() {
    const modules = await this.modulesService.findAll();
    return envelope(modules);
  }

  @Get(':name')
  async findOne(@Param('name') name: string) {
    const module = await this.modulesService.findOne(name);
    if (!module) {
      throw new NotFoundException(`Module "${name}" not found`);
    }
    return envelope(module);
  }

  /** Admin use (manual edits) — self-registration always goes through POST /register. */
  @Patch(':name')
  async update(@Param('name') name: string, @Body() body: unknown) {
    const parsed = registerModuleSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.modulesService.update(name, parsed.data));
  }

  @Delete(':name')
  @HttpCode(204)
  async remove(@Param('name') name: string) {
    await this.modulesService.remove(name);
  }
}
