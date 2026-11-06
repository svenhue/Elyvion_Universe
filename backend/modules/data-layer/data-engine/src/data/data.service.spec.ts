import { BadGatewayException } from '@nestjs/common';
import { AuthorizationObligations } from '@elyvion/shared';
import { EntityRegistryService } from '../entities/entity-registry.service';
import { DataService } from './data.service';

describe('DataService tenant and row enforcement', () => {
  const rows = [{ _id: 'row-1', tenantId: 'tenant-a', region: 'west', email: 'person@example.test' }];
  const cursor = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(rows),
  };
  const model = { find: jest.fn().mockReturnValue(cursor) };
  const registry = {
    getDataModel: jest.fn().mockResolvedValue(model),
    getFields: jest.fn().mockResolvedValue([
      { name: 'region', type: 'string', required: false },
      { name: 'email', type: 'string', required: false },
    ]),
  } as unknown as EntityRegistryService;
  const service = new DataService(registry);

  beforeEach(() => {
    jest.clearAllMocks();
    model.find.mockReturnValue(cursor);
    cursor.lean.mockResolvedValue(rows);
  });

  it('combines tenant isolation and policy row filters and applies masking and row limits', async () => {
    const obligations: AuthorizationObligations = {
      rowFilter: { region: 'west' },
      maskColumns: ['email'],
      maxRows: 50,
    };

    const result = await service.list('people', 'tenant-a', undefined, obligations);

    expect(model.find).toHaveBeenCalledWith({
      $and: [{ tenantId: 'tenant-a' }, { region: 'west' }],
    });
    expect(cursor.limit).toHaveBeenCalledWith(50);
    expect(result[0]['email']).toBe('[REDACTED]');
    expect(result[0]['tenantId']).toBe('tenant-a');
  });

  it('fails closed when a row filter references a field outside the entity schema', async () => {
    await expect(
      service.list('people', 'tenant-a', undefined, { rowFilter: { missingField: 'value' } }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(model.find).not.toHaveBeenCalled();
  });
});
