import ollama from 'ollama';
import { LlmMessage } from './llm.service';
import { Injectable } from '@nestjs/common/decorators/core/injectable.decorator';
import { LlmService } from './I.llm.service';

@Injectable()
export class OllamaService implements LlmService{

    private readonly model = 'qwen30:8b';
    async complete(history: LlmMessage[], stream: boolean = true): Promise<string | ReadableStream<Uint8Array>> {

        if(stream){
        const encoder = new TextEncoder();

        const ollamaStream = await ollama.chat({
            model: this.model, // z. B. "qwen3:8b"
            messages: history,
            stream: true,
            think: false, // optional; nur falls dein Qwen-Modell das unterstützt
        });

        return new ReadableStream<Uint8Array>({
            async start(controller) {
            try {
                for await (const chunk of ollamaStream) {
                const content = chunk.message.content;

                if (typeof content === 'string' && content.length > 0) {
                    controller.enqueue(encoder.encode(content));
                }
                }

                controller.close();
            } catch (error) {
                controller.error(error);
            }
            },
        });
        } else {
             throw new Error('Non-streaming mode is not implemented yet.');
        } 
    }
}