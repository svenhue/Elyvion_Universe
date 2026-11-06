import axios from 'axios';
import { checkAuthorization } from '@elyvion/shared';

jest.mock('axios');

const mockedPost = jest.mocked(axios.post);

describe('checkAuthorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('denies when tenant context is missing without calling the PDP', async () => {
    const result = await checkAuthorization({
      securityUrl: 'http://security',
      requiredPermission: 'data-engine:read',
      authorization: 'Bearer access-token',
    });

    expect(result).toEqual({
      allowed: false,
      decision: 'DENY',
      reason: 'x-tenant-id is required',
    });
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('sends the bearer token and tenant to the versioned PDP endpoint', async () => {
    mockedPost.mockResolvedValue({
      data: { data: { decision: 'ALLOW', reason: 'role permission' } },
    } as never);

    const result = await checkAuthorization({
      securityUrl: 'http://security',
      requiredPermission: 'data-engine:read',
      authorization: 'Bearer access-token',
      tenantId: 'tenant-1',
    });

    expect(result).toEqual({
      allowed: true,
      decision: 'ALLOW',
      reason: 'role permission',
    });
    expect(mockedPost).toHaveBeenCalledWith(
      'http://security/v1/authorize',
      {
        action: 'read',
        resource: { type: 'data-engine' },
        context: {},
      },
      {
        headers: {
          authorization: 'Bearer access-token',
          'x-tenant-id': 'tenant-1',
        },
        timeout: 5000,
      },
    );
  });

  it('denies when the PDP is unavailable', async () => {
    mockedPost.mockRejectedValue(new Error('connection refused'));

    const result = await checkAuthorization({
      securityUrl: 'http://security',
      requiredPermission: 'data-engine:read',
      authorization: 'Bearer access-token',
      tenantId: 'tenant-1',
    });

    expect(result).toEqual({
      allowed: false,
      decision: 'DENY',
      reason: 'authorization service is unavailable',
    });
  });
});
