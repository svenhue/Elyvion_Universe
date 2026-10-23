import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvAvatarProperties extends ElvUiProperties {
  src?: string;
  alt?: string;
  initials?: string;
  size?: string;
}

@Component({
  selector: 'elv-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="elv-avatar" [ngClass]="properties.className" [ngStyle]="avatarStyles">
      @if (properties.src) { <img [src]="properties.src" [alt]="properties.alt ?? ''" /> }
      @else { {{ properties.initials ?? '?' }} }
    </span>
  `,
  styles: [`.elv-avatar{display:inline-grid;place-items:center;border-radius:50%;width:2.5rem;height:2.5rem;overflow:hidden;background:#e2e8f0;color:#334155;font-weight:600}.elv-avatar img{width:100%;height:100%;object-fit:cover}`],
})
export class ElvAvatarComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvAvatarProperties = {};

  get avatarStyles(): Record<string, string | number> {
    return { ...this.properties.styles, width: this.properties.size ?? '2.5rem', height: this.properties.size ?? '2.5rem' };
  }
}
