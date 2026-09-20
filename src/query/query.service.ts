import { Inject, Injectable } from '@nestjs/common';

import { EMBEDDING_PROVIDER } from '../embeddings/embedding-provider';
import type { EmbeddingProvider } from '../embeddings/embedding-provider';
import { LLM_PROVIDER } from '../llm/llm-provider';
import type { LlmProvider } from '../llm/llm-provider';
import { buildContext } from './context-builder';
import { QueryDto } from './dto/query.dto';
import { mergeHybridResults } from './hybrid-search';
import { QueryRepository } from './query.repository';

@Injectable()
export class QueryService {
  constructor(
    private readonly queryRepository: QueryRepository,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: EmbeddingProvider,
    @Inject(LLM_PROVIDER)
    private readonly llmProvider: LlmProvider,
  ) {}

  async query(dto: QueryDto) {
    const embedding = await this.embeddingProvider.embed({
      text: dto.question,
    });

    const [vectorResults, keywordResults] = await Promise.all([
      this.queryRepository.vectorSearch({
        embedding,
        limit: 10,
      }),
      this.queryRepository.keywordSearch({
        query: dto.question,
        limit: 10,
      }),
    ]);

    const results = mergeHybridResults({
      vectorResults,
      keywordResults,
      limit: 5,
    });

    const context = buildContext({
      results,
    });

    const generated = await this.llmProvider.generateAnswer({
      question: dto.question,
      context: context.text,
    });

    return {
      question: dto.question,
      answer: generated.answer,
      sources: context.sources,
      debug: {
        results,
        context,
      },
    };
  }
}
