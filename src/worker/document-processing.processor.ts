import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Job } from 'bullmq';

import { DocumentsRepository } from '../documents/documents.repository';
import { EMBEDDING_PROVIDER } from '../embeddings/embedding-provider';
import type { EmbeddingProvider } from '../embeddings/embedding-provider';
import { cleanText } from '../ingestion/text-cleaner';
import { chunkText } from '../ingestion/text-chunker';
import { ProcessDocumentJobData } from '../queues/documents-queue.service';
import { DOCUMENT_PROCESSING_QUEUE } from '../queues/queue.constants';

@Injectable()
@Processor(DOCUMENT_PROCESSING_QUEUE)
export class DocumentProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessingProcessor.name);

  constructor(
    private readonly documentsRepository: DocumentsRepository,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: EmbeddingProvider,
  ) {
    super();
  }

  async process(job: Job<ProcessDocumentJobData>): Promise<void> {
    this.logger.log(`Processing document ${job.data.documentId}`);

    try {
      await this.documentsRepository.updateStatus(
        job.data.documentId,
        'processing',
      );

      const rawText = await this.documentsRepository.findRawTextById(
        job.data.documentId,
      );

      if (!rawText) {
        throw new NotFoundException(
          `Raw text for document ${job.data.documentId} not found`,
        );
      }

      await job.updateProgress(25);

      const cleanedText = cleanText(rawText);
      const chunks = chunkText(cleanedText);

      await job.updateProgress(60);

      await this.documentsRepository.replaceChunks(
        chunks.map((chunk) => ({
          documentId: job.data.documentId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          metadata: {},
        })),
      );

      await job.updateProgress(80);

      for (const chunk of chunks) {
        const embedding = await this.embeddingProvider.embed({
          text: chunk.content,
        });

        await this.documentsRepository.updateChunkEmbedding({
          documentId: job.data.documentId,
          chunkIndex: chunk.chunkIndex,
          embedding,
        });
      }

      await this.documentsRepository.updateStatus(
        job.data.documentId,
        'completed',
      );

      await job.updateProgress(100);
    } catch (error) {
      await this.documentsRepository.updateStatus(
        job.data.documentId,
        'failed',
      );
      this.logger.error(
        `Failed to process document ${job.data.documentId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
