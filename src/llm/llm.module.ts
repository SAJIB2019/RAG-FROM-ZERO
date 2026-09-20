import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FakeLlmProvider } from './fake-llm.provider';
import { LLM_PROVIDER } from './llm-provider';
import { OpenAiCompatibleLlmProvider } from './openai-compatible-llm.provider';

@Module({
  providers: [
    FakeLlmProvider,
    OpenAiCompatibleLlmProvider,
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService, FakeLlmProvider, OpenAiCompatibleLlmProvider],
      useFactory: (
        configService: ConfigService,
        fakeProvider: FakeLlmProvider,
        openAiCompatibleProvider: OpenAiCompatibleLlmProvider,
      ) => {
        const provider = configService.getOrThrow<string>('LLM_PROVIDER');

        if (provider === 'openai-compatible') {
          return openAiCompatibleProvider;
        }

        return fakeProvider;
      },
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
