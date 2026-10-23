import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ApiClientService, AuthService, ElvButtonComponent, ElvCardComponent } from '@elyvion/shared-lib';

interface Task {
  id: string;
  title: string;
  done: boolean;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ElvButtonComponent, ElvCardComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiClientService);

  protected readonly tasks = signal<Task[]>([]);
  protected readonly tasksError = signal<string | null>(null);

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) return;
    this.loadTasks();
  }

  login(): void {
    void this.auth.login();
  }

  logout(): void {
    this.auth.logout();
  }

  private loadTasks(): void {
    this.api.get<Task[]>('my-module', '/tasks').subscribe({
      next: (res) => this.tasks.set(res.data),
      error: () => this.tasksError.set('Gateway/Modul nicht erreichbar oder nicht eingeloggt.'),
    });
  }
}
