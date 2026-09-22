import { Inject, Injectable } from '@nestjs/common';
import { RunnableLambda } from '@langchain/core/runnables';

import { EMBEDDING_PROVIDER } from '../embeddings/embedding-provider';
import type { EmbeddingProvider } from '../embeddings/embedding-provider';
import { LLM_PROVIDER } from '../llm/llm-provider';
import type { LlmProvider } from '../llm/llm-provider';
import { buildContext } from './context-builder';
import { QueryDto } from './dto/query.dto';
import { mergeHybridResults } from './hybrid-search';
import { QueryRepository } from './query.repository';
import { traced } from '../telemetry/traced';

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
    const embed = RunnableLambda.from(async (question: string) => ({
      question,
      embedding: await traced('rag.embed', () =>
        this.embeddingProvider.embed({ text: question }),
      ),
    })).withConfig({ runName: 'embed-question' });
    const pipeline = embed
      .pipe(
        RunnableLambda.from(
          async ({
            question,
            embedding,
          }: {
            question: string;
            embedding: number[];
          }) => {
            const [vectorResults, keywordResults] = await Promise.all([
              traced('rag.retrieve.vector', () =>
                this.queryRepository.vectorSearch({ embedding, limit: 10 }),
              ),
              traced('rag.retrieve.keyword', () =>
                this.queryRepository.keywordSearch({
                  query: question,
                  limit: 10,
                }),
              ),
            ]);
            const results = mergeHybridResults({
              vectorResults,
              keywordResults,
              limit: 5,
            });
            return { question, results, context: buildContext({ results }) };
          },
        ).withConfig({ runName: 'hybrid-retrieval' }),
      )
      .pipe(
        RunnableLambda.from(
          async (input: {
            question: string;
            results: ReturnType<typeof mergeHybridResults>;
            context: ReturnType<typeof buildContext>;
          }) => {
            const generated = await traced('rag.generate', () =>
              this.llmProvider.generateAnswer({
                question: input.question,
                context: input.context.text,
              }),
            );
            return {
              question: input.question,
              answer: generated.answer,
              sources: input.context.sources,
              debug: { results: input.results, context: input.context },
            };
          },
        ).withConfig({ runName: 'generate-answer' }),
      );
    return traced('rag.query', () => pipeline.invoke(dto.question));
  }
}
