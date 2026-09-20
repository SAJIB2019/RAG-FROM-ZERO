import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EMBEDDING_PROVIDER } from './embedding-provider';
import { FakeEmbeddingProvider } from './fake-embedding.provider';
import { OpenAiCompatibleEmbeddingProvider } from './openai-compatible-embedding.provider';

@Module({
  providers: [
    FakeEmbeddingProvider,
    OpenAiCompatibleEmbeddingProvider,
    {
      provide: EMBEDDING_PROVIDER,
      inject: [
        ConfigService,
        FakeEmbeddingProvider,
        OpenAiCompatibleEmbeddingProvider,
      ],
      useFactory: (
        configService: ConfigService,
        fakeProvider: FakeEmbeddingProvider,
        openAiCompatibleProvider: OpenAiCompatibleEmbeddingProvider,
      ) => {
        const provider = configService.getOrThrow<string>('EMBEDDING_PROVIDER');

        if (provider === 'openai-compatible') {
          return openAiCompatibleProvider;
        }

        return fakeProvider;
      },
    },
  ],
  exports: [EMBEDDING_PROVIDER],
})
export class EmbeddingsModule {}
