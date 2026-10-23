import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Task } from './task.model';

/**
 * In-memory example resource — replace with a real persistence layer
 * (Prisma + Postgres, following the pattern in modules/registry) once this
 * template is cloned for an actual business module.
 */
@Injectable()
export class TasksService {
  private readonly tasks = new Map<string, Task>();

  create(title: string): Task {
    const task: Task = { id: randomUUID(), title, done: false, createdAt: new Date().toISOString() };
    this.tasks.set(task.id, task);
    return task;
  }

  findAll(): Task[] {
    return [...this.tasks.values()];
  }

  findOne(id: string): Task {
    const task = this.tasks.get(id);
    if (!task) throw new NotFoundException(`Task "${id}" not found`);
    return task;
  }

  complete(id: string): Task {
    const task = this.findOne(id);
    task.done = true;
    return task;
  }
}
