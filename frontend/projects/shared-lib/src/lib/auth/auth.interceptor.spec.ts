import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { createAuthInterceptor } from './auth.interceptor';

describe('createAuthInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let refreshAccessToken: jasmine.Spy;

  beforeEach(() => {
    refreshAccessToken = jasmine.createSpy().and.returnValue(of('refreshed-access-token'));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([createAuthInterceptor(['http://localhost:3000'])])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getAccessToken: () => 'expired-access-token',
            refreshAccessToken,
          },
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('refreshes an expired token and retries the API request once', () => {
    let result: unknown;
    http.get('http://localhost:3000/api/app-config/configs/default').subscribe({
      next: (response) => (result = response),
      error: (error: unknown) => (result = error),
    });

    const initialRequest = httpTesting.expectOne('http://localhost:3000/api/app-config/configs/default');
    expect(initialRequest.request.headers.get('Authorization')).toBe('Bearer expired-access-token');
    initialRequest.flush(
      { error: { statusCode: 401, message: 'Invalid or expired token' } },
      { status: 401, statusText: 'Unauthorized' },
    );

    const retryRequest = httpTesting.expectOne('http://localhost:3000/api/app-config/configs/default');
    expect(retryRequest.request.headers.get('Authorization')).toBe('Bearer refreshed-access-token');
    retryRequest.flush({ data: { applicationId: 'default' } });

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: { applicationId: 'default' } });
  });

  it('does not refresh for non-API requests', () => {
    let result: unknown;
    http.get('https://example.com/data').subscribe({
      error: (error: unknown) => (result = error),
    });

    httpTesting.expectOne('https://example.com/data').flush('unauthorized', {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(result).toEqual(jasmine.any(HttpErrorResponse));
  });
});
