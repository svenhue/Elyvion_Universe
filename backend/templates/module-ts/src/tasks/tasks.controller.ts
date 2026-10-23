import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() body: { title: string }) {
    return envelope(this.tasksService.create(body.title));
  }

  @Get()
  findAll() {
    return envelope(this.tasksService.findAll());
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return envelope(this.tasksService.findOne(id));
  }

  @Patch(':id/complete')
  complete(@Param('id') id: string) {
    return envelope(this.tasksService.complete(id));
  }
}
