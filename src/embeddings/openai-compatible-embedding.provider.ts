import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmbeddingInput, EmbeddingProvider } from './embedding-provider';

type EmbeddingsResponse = {
  data?: Array<{
    embedding?: unknown;
  }>;
  error?: {
    message?: string;
  };
};

@Injectable()
export class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly configService: ConfigService) {}

  async embed(input: EmbeddingInput): Promise<number[]> {
    const baseUrl = this.getRequiredConfig('OPENAI_COMPATIBLE_BASE_URL');
    const apiKey = this.getRequiredConfig('OPENAI_COMPATIBLE_API_KEY');
    const model = this.configService.getOrThrow<string>('EMBEDDING_MODEL');
    const dimensions = this.configService.getOrThrow<number>(
      'EMBEDDING_DIMENSIONS',
    );
    const timeoutMs = this.configService.getOrThrow<number>(
      'OPENAI_COMPATIBLE_TIMEOUT_MS',
    );

    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: input.text,
        dimensions,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const body = (await response
      .json()
      .catch(() => ({}))) as EmbeddingsResponse;

    if (!response.ok) {
      throw new Error(
        `Embedding request failed with ${response.status}: ${
          body.error?.message ?? response.statusText
        }`,
      );
    }

    const embedding = body.data?.[0]?.embedding;

    if (!isNumberArray(embedding)) {
      throw new Error('Embedding response did not include a numeric vector.');
    }

    if (embedding.length !== dimensions) {
      throw new Error(
        `Embedding dimension mismatch. Expected ${dimensions}, received ${embedding.length}.`,
      );
    }

    return embedding;
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.getOrThrow<string>(key).trim();

    if (!value) {
      throw new Error(
        `${key} is required when EMBEDDING_PROVIDER=openai-compatible.`,
      );
    }

    return value;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item))
  );
}
