import { chunkText } from './text-chunker';

describe('LlamaIndex chunking', () => {
  it('preserves a short document and counts actual tokens', async () => {
    const chunks = await chunkText(
      'Customers may request refunds within 30 days.',
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      chunkIndex: 0,
      content: 'Customers may request refunds within 30 days.',
    });
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('splits long text into bounded nonempty chunks', async () => {
    const chunks = await chunkText(
      'Refunds are available within thirty days. '.repeat(80),
      { chunkSize: 40, chunkOverlap: 5 },
    );
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, index) => {
      expect(chunk.chunkIndex).toBe(index);
      expect(chunk.tokenCount).toBeLessThanOrEqual(40);
      expect(chunk.content.length).toBeGreaterThan(0);
    });
  });

  it('handles empty text and rejects invalid overlap', async () => {
    expect(await chunkText('  ')).toEqual([]);
    await expect(
      chunkText('text', { chunkSize: 20, chunkOverlap: 20 }),
    ).rejects.toThrow('overlap');
  });
});
