export const documentStatuses = [
  'uploaded',
  'queued',
  'processing',
  'completed',
  'failed',
] as const;

export type DocumentStatus = (typeof documentStatuses)[number];
