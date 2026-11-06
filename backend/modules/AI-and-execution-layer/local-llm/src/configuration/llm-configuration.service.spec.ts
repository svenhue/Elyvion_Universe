import { Model } from 'mongoose';
import { LlmConfiguration, LlmConfigurationDocument } from './llm-configuration.schema';
import { LlmConfigurationService } from './llm-configuration.service';

describe('LlmConfigurationService', () => {
  let service: LlmConfigurationService;
  let model: {
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    updateOne: jest.Mock;
  };
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    model = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(configuration),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(configuration),
      }),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    service = new LlmConfigurationService(model as unknown as Model<LlmConfigurationDocument>);
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => fetchMock.mockRestore());

  it('initializes one global row without replacing admin changes', async () => {
    await service.onModuleInit();

    expect(model.updateOne).toHaveBeenCalledWith(
      { scope: 'global' },
      expect.objectContaining({ $setOnInsert: expect.objectContaining({ scope: 'global' }) }),
      { upsert: true },
    );
  });

  it('rejects credentials embedded in an admin-configured Ollama URL', async () => {
    await expect(service.updateGlobal({
      ...configuration,
      baseUrl: 'http://user:password@localhost:11434',
    })).rejects.toThrow('must not contain credentials');
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('proxies OpenAI-compatible requests using the global model and generation settings', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'hello' } }],
    }), { status: 200 }));

    await service.complete({
      model: 'caller-selected-model',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 1.8,
      options: { top_p: 0.9 },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://ollama:11434/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'qwen3:4b',
          messages: [{ role: 'user', content: 'hello' }],
          temperature: 0.2,
          options: { top_p: 0.9, num_ctx: 8192 },
          stream: false,
        }),
      }),
    );
  });
});

const configuration = {
  scope: 'global',
  baseUrl: 'http://ollama:11434',
  model: 'qwen3:4b',
  temperature: 0.2,
  numCtx: 8192,
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
