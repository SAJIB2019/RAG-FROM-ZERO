import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  GenerateAnswerInput,
  GenerateAnswerOutput,
  LlmProvider,
} from './llm-provider';

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: string;
  };
};

@Injectable()
export class OpenAiCompatibleLlmProvider implements LlmProvider {
  constructor(private readonly configService: ConfigService) {}

  async generateAnswer(
    input: GenerateAnswerInput,
  ): Promise<GenerateAnswerOutput> {
    const baseUrl = this.getRequiredConfig('OPENAI_COMPATIBLE_BASE_URL');
    const apiKey = this.getRequiredConfig('OPENAI_COMPATIBLE_API_KEY');
    const model = this.configService.getOrThrow<string>('LLM_MODEL');
    const timeoutMs = this.configService.getOrThrow<number>(
      'OPENAI_COMPATIBLE_TIMEOUT_MS',
    );

    const response = await fetch(
      `${normalizeBaseUrl(baseUrl)}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content:
                'You answer using only the provided context. If the context is insufficient, say you do not have enough information. Cite sources using the provided [source:n] markers when relevant.',
            },
            {
              role: 'user',
              content: formatUserPrompt(input),
            },
          ],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );

    const body = (await response
      .json()
      .catch(() => ({}))) as ChatCompletionResponse;

    if (!response.ok) {
      throw new Error(
        `LLM request failed with ${response.status}: ${
          body.error?.message ?? response.statusText
        }`,
      );
    }

    const answer = body.choices?.[0]?.message?.content;

    if (typeof answer !== 'string' || !answer.trim()) {
      throw new Error('LLM response did not include answer text.');
    }

    return {
      answer,
    };
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.getOrThrow<string>(key).trim();

    if (!value) {
      throw new Error(
        `${key} is required when LLM_PROVIDER=openai-compatible.`,
      );
    }

    return value;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function formatUserPrompt(input: GenerateAnswerInput): string {
  return [
    'Question:',
    input.question,
    '',
    'Retrieved context:',
    input.context || '(no retrieved context)',
  ].join('\n');
}
