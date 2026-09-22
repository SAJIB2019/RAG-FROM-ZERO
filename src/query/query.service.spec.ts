import { jest } from '@jest/globals';
import { QueryService } from './query.service';
import { QueryRepository } from './query.repository';

describe('LangChain query pipeline', () => {
  it('fuses retrieval results and passes the same context to generation and evaluation', async () => {
    const hit = {
      documentId: 'doc',
      filename: 'policy.txt',
      chunkIndex: 0,
      content: 'Refunds within 30 days.',
      score: 0.1,
    };
    const repository = {
      vectorSearch: jest.fn().mockReturnValue(Promise.resolve([hit])),
      keywordSearch: jest.fn().mockReturnValue(Promise.resolve([hit])),
    };
    const embed = jest.fn<() => Promise<number[]>>().mockResolvedValue([1, 0]);
    const generateAnswer = jest
      .fn<() => Promise<{ answer: string }>>()
      .mockResolvedValue({ answer: '30 days [source:1]' });
    const service = new QueryService(
      repository as unknown as QueryRepository,
      { embed },
      { generateAnswer },
    );
    const result = await service.query({ question: 'Refund deadline?' });
    expect(result.sources).toHaveLength(1);
    expect(result.debug.results[0].sources).toEqual(['vector', 'keyword']);
    expect(generateAnswer).toHaveBeenCalledWith({
      question: 'Refund deadline?',
      context: result.debug.context.text,
    });
    expect(result.answer).toBe('30 days [source:1]');
  });

  it('propagates retrieval failures without generating a misleading answer', async () => {
    const repository = {
      vectorSearch: () => Promise.reject(new Error('Qdrant unavailable')),
      keywordSearch: () => Promise.resolve([]),
    };
    const generateAnswer = jest.fn<() => Promise<{ answer: string }>>();
    const service = new QueryService(
      repository as unknown as QueryRepository,
      { embed: () => Promise.resolve([1, 0]) },
      { generateAnswer },
    );
    await expect(
      service.query({ question: 'Refund deadline?' }),
    ).rejects.toThrow('Qdrant unavailable');
    expect(generateAnswer).not.toHaveBeenCalled();
  });
});
