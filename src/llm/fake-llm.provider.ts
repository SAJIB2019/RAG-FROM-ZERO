import { Injectable } from '@nestjs/common';

import {
  GenerateAnswerInput,
  GenerateAnswerOutput,
  LlmProvider,
} from './llm-provider';

@Injectable()
export class FakeLlmProvider implements LlmProvider {
  generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerOutput> {
    if (!input.context.trim()) {
      return Promise.resolve({
        answer:
          "I don't have enough retrieved context to answer that question yet.",
      });
    }

    return Promise.resolve({
      answer: `Based on the retrieved context, here is a draft answer to: "${input.question}".`,
    });
  }
}
