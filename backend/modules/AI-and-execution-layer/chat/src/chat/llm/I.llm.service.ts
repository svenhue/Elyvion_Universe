import { LlmMessage } from './llm.service';

export interface LlmService {
    complete(history: LlmMessage[], stream: boolean): Promise<string | ReadableStream<Uint8Array>>;
}