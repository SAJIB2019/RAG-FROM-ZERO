export type TextChunk = {
  chunkIndex: number;
  content: string;
  tokenCount: number;
};

export async function chunkText(
  text: string,
  options = {
    chunkSize: 200,
    chunkOverlap: 30,
  },
): Promise<TextChunk[]> {
  if (
    !Number.isInteger(options.chunkSize) ||
    options.chunkSize <= 0 ||
    !Number.isInteger(options.chunkOverlap) ||
    options.chunkOverlap < 0 ||
    options.chunkOverlap >= options.chunkSize
  ) {
    throw new Error(
      'Chunk size must be positive and overlap must be smaller than chunk size',
    );
  }
  const { SentenceSplitter } = await import('@llamaindex/core/node-parser');
  const splitter = new SentenceSplitter(options);
  return splitter
    .splitText(text)
    .map((content) => content.trim())
    .filter(Boolean)
    .map((content, chunkIndex) => ({
      chunkIndex,
      content,
      tokenCount: splitter.tokenSize(content),
    }));
}
