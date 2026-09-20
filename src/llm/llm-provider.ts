export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export type GenerateAnswerInput = {
  question: string;
  context: string;
};

export type GenerateAnswerOutput = {
  answer: string;
};

export type LlmProvider = {
  generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerOutput>;
};
