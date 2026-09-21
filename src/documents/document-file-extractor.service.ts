import { BadRequestException, Injectable } from '@nestjs/common';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import readXlsxFile from 'read-excel-file/node';

type SupportedFileKind =
  'pdf' | 'docx' | 'xlsx' | 'csv' | 'text' | 'json' | 'html';

const supportedMimeTypes: Record<string, SupportedFileKind> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'text/plain': 'text',
  'text/markdown': 'text',
  'application/json': 'json',
  'text/html': 'html',
};

const supportedExtensions: Record<string, SupportedFileKind> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.xlsx': 'xlsx',
  '.csv': 'csv',
  '.txt': 'text',
  '.md': 'text',
  '.markdown': 'text',
  '.json': 'json',
  '.html': 'html',
  '.htm': 'html',
};

export type ExtractedDocumentFile = {
  filename: string;
  mimeType: string;
  content: string;
};

@Injectable()
export class DocumentFileExtractorService {
  async extract(file: Express.Multer.File): Promise<ExtractedDocumentFile> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Uploaded file is empty');
    }

    const kind = getSupportedFileKind(file.mimetype, file.originalname);
    const content = await this.extractText(file.buffer, kind);
    const normalizedContent = content.trim();

    if (!normalizedContent) {
      throw new BadRequestException(
        'No readable text could be extracted from the uploaded file',
      );
    }

    return {
      filename: file.originalname,
      mimeType: file.mimetype || getMimeTypeFromFilename(file.originalname),
      content: normalizedContent,
    };
  }

  private async extractText(
    buffer: Buffer,
    kind: SupportedFileKind,
  ): Promise<string> {
    switch (kind) {
      case 'pdf': {
        const parser = new PDFParse({ data: buffer });

        try {
          const parsed = await parser.getText();

          return parsed.text;
        } finally {
          await parser.destroy();
        }
      }

      case 'docx': {
        const result = await mammoth.extractRawText({ buffer });

        return result.value;
      }

      case 'xlsx':
        return extractXlsxText(buffer);

      case 'csv':
        return buffer.toString('utf8');

      case 'json':
        return normalizeJson(buffer);

      case 'html':
        return stripHtml(buffer.toString('utf8'));

      case 'text':
        return buffer.toString('utf8');
    }
  }
}

function getSupportedFileKind(
  mimeType: string,
  filename: string,
): SupportedFileKind {
  const byMimeType = supportedMimeTypes[mimeType];

  if (byMimeType) {
    return byMimeType;
  }

  const extension = getFileExtension(filename);
  const byExtension = supportedExtensions[extension];

  if (byExtension) {
    return byExtension;
  }

  throw new BadRequestException(
    `Unsupported file type. Supported uploads: PDF, DOCX, XLSX, CSV, TXT, Markdown, JSON, and HTML.`,
  );
}

async function extractXlsxText(buffer: Buffer): Promise<string> {
  const sheets = await readXlsxFile(buffer);

  return sheets
    .map(({ sheet, data }) => {
      const rows = data
        .map((row) =>
          row
            .map((cell) =>
              cell instanceof Date ? cell.toISOString() : String(cell ?? ''),
            )
            .join('\t'),
        )
        .join('\n');

      return `Sheet: ${sheet}\n${rows}`;
    })
    .join('\n\n');
}

function normalizeJson(buffer: Buffer): string {
  const raw = buffer.toString('utf8');

  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ');
}

function getMimeTypeFromFilename(filename: string): string {
  const extension = getFileExtension(filename);
  const match = Object.entries(supportedExtensions).find(
    ([knownExtension]) => knownExtension === extension,
  );

  if (!match) {
    return 'application/octet-stream';
  }

  const [, kind] = match;

  switch (kind) {
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'csv':
      return 'text/csv';
    case 'json':
      return 'application/json';
    case 'html':
      return 'text/html';
    case 'text':
      return 'text/plain';
  }
}

function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');

  return dotIndex === -1 ? '' : filename.slice(dotIndex).toLowerCase();
}
