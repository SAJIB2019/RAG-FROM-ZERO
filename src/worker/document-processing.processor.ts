import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { DocumentsRepository } from '../documents/documents.repository';
import { ProcessDocumentJobData } from '../queues/documents-queue.service';
import { DOCUMENT_PROCESSING_QUEUE } from '../queues/queue.constants';

@Injectable()
@Processor(DOCUMENT_PROCESSING_QUEUE)
export class DocumentProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessingProcessor.name);

  constructor(private readonly documentsRepository: DocumentsRepository) {
    super();
  }

  async process(job: Job<ProcessDocumentJobData>): Promise<void> {
    this.logger.log(`Processing document ${job.data.documentId}`);

    await this.documentsRepository.updateStatus(
      job.data.documentId,
      'processing',
    );

    await job.updateProgress(50);

    // Real extraction, chunking, embedding, and indexing will be added later.
    await this.documentsRepository.updateStatus(
      job.data.documentId,
      'completed',
    );

    await job.updateProgress(100);
  }
}
