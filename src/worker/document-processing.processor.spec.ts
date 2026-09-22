import { jest } from '@jest/globals';
import { Job } from 'bullmq';
import { DocumentsRepository } from '../documents/documents.repository';
import { SearchService } from '../search/search.service';
import { ProcessDocumentJobData } from '../queues/documents-queue.service';
import { DocumentProcessingProcessor } from './document-processing.processor';

describe('document indexing lifecycle', () => {
  it('does not mark a document completed after an external index failure', async () => {
    const updateStatus = jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined);
    const repository = {
      updateStatus,
      findRawTextById: () => Promise.resolve('Refunds within 30 days.'),
      replaceChunks: () => Promise.resolve(),
      updateChunkEmbedding: () => Promise.resolve(),
    };
    const syncDocument = jest
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error('Index unavailable'));
    const processor = new DocumentProcessingProcessor(
      repository as unknown as DocumentsRepository,
      { embed: () => Promise.resolve([1, 0]) },
      { syncDocument } as unknown as SearchService,
    );
    const job = {
      data: { documentId: 'doc-1' },
      updateProgress: () => Promise.resolve(),
    } as unknown as Job<ProcessDocumentJobData>;
    await expect(processor.process(job)).rejects.toThrow('Index unavailable');
    expect(updateStatus).toHaveBeenLastCalledWith('doc-1', 'failed');
    expect(updateStatus).not.toHaveBeenCalledWith('doc-1', 'completed');
  });
});
