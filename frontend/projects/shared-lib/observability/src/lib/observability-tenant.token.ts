import { InjectionToken, Signal } from '@angular/core';

export const OBSERVABILITY_TENANT_ID = new InjectionToken<Signal<string>>('OBSERVABILITY_TENANT_ID');
