export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

export type EmbeddingInput = {
  text: string;
};

export type EmbeddingProvider = {
  embed(input: EmbeddingInput): Promise<number[]>;
};
