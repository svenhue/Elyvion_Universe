import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ELYVION_AUTH_CONFIG, ELYVION_GATEWAY_URL } from '@elyvion/shared-lib';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ELYVION_GATEWAY_URL, useValue: 'http://localhost:3000' },
        {
          provide: ELYVION_AUTH_CONFIG,
          useValue: {
            issuer: 'http://localhost:3011',
            clientId: 'elyvion-client',
            redirectUri: 'http://localhost:4200/auth/callback',
            postLogoutRedirectUri: 'http://localhost:4200/',
            scope: 'openid profile email offline_access',
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Elyvion Client Skeleton');
  });
});
