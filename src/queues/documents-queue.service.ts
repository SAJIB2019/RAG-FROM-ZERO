import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import {
  DOCUMENT_PROCESSING_QUEUE,
  PROCESS_DOCUMENT_JOB,
} from './queue.constants';

export type ProcessDocumentJobData = {
  documentId: string;
};

@Injectable()
export class DocumentsQueueService {
  constructor(
    @InjectQueue(DOCUMENT_PROCESSING_QUEUE)
    private readonly queue: Queue<ProcessDocumentJobData>,
  ) {}

  async enqueueDocumentProcessing(data: ProcessDocumentJobData): Promise<void> {
    await this.queue.add(PROCESS_DOCUMENT_JOB, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }
}
