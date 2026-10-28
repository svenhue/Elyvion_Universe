import { upsertAppConfigSchema } from './resolve-schema.dto';

describe('upsertAppConfigSchema', () => {
  const base = {
    applicationId: 'default',
    name: 'Default App',
    version: '1.0.0',
    rootComponentId: 'root',
  };

  it('accepts native element/text nodes and absolute positions', () => {
    const parsed = upsertAppConfigSchema.safeParse({
      ...base,
      components: [
        {
          id: 'root',
          type: 'element',
          element: 'main',
          children: ['label'],
        },
        {
          id: 'label',
          type: 'text',
          text: 'Hello',
          position: { x: 12, y: 24, zIndex: 2, order: 1 },
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it('accepts legacy component schemas with a component name', () => {
    const parsed = upsertAppConfigSchema.safeParse({
      ...base,
      components: [{ id: 'root', name: 'button', attributes: { label: 'Save' } }],
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects missing root nodes and malformed positions', () => {
    const missingRoot = upsertAppConfigSchema.safeParse({
      ...base,
      components: [{ id: 'child', type: 'element', element: 'div' }],
    });
    const malformedPosition = upsertAppConfigSchema.safeParse({
      ...base,
      components: [{ id: 'root', type: 'element', element: 'main', position: { x: 'left', y: 0 } }],
    });

    expect(missingRoot.success).toBe(false);
    expect(malformedPosition.success).toBe(false);
  });
});
