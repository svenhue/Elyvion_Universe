import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvSkeletonProperties extends ElvUiProperties {
  width?: string;
  height?: string;
  circle?: boolean;
}

@Component({
  selector: 'elv-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="elv-skeleton" [class.elv-skeleton--circle]="properties.circle ?? false" [ngClass]="properties.className" [ngStyle]="skeletonStyles" aria-hidden="true"></span>`,
  styles: [`.elv-skeleton{display:block;width:100%;height:1rem;border-radius:5px;background:linear-gradient(90deg,#e2e8f0,#f1f5f9,#e2e8f0);background-size:200% 100%;animation:elv-shimmer 1.4s ease-in-out infinite}.elv-skeleton--circle{border-radius:50%}@keyframes elv-shimmer{to{background-position:-200% 0}}`],
})
export class ElvSkeletonComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvSkeletonProperties = {};

  get skeletonStyles(): Record<string, string | number> {
    return {
      ...this.properties.styles,
      width: this.properties.width ?? '100%',
      height: this.properties.height ?? '1rem',
    };
  }
}
