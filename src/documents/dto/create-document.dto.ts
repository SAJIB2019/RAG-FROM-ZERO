import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const allowedMimeTypes = [
  'application/pdf',
  'text/plain',
  'text/markdown',
] as const;

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsString()
  @IsIn(allowedMimeTypes)
  mimeType!: (typeof allowedMimeTypes)[number];

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  source?: string;
}
