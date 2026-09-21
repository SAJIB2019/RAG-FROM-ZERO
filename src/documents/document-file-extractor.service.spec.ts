import { BadRequestException } from '@nestjs/common';

import { DocumentFileExtractorService } from './document-file-extractor.service';

describe('DocumentFileExtractorService', () => {
  const service = new DocumentFileExtractorService();

  it('extracts plain text uploads', async () => {
    const result = await service.extract(
      createFile({
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        content: '  Project notes  ',
      }),
    );

    expect(result).toEqual({
      filename: 'notes.txt',
      mimeType: 'text/plain',
      content: 'Project notes',
    });
  });

  it('supports csv files when the client sends octet-stream', async () => {
    const result = await service.extract(
      createFile({
        originalname: 'customers.csv',
        mimetype: 'application/octet-stream',
        content: 'name,plan\nAlice,Pro',
      }),
    );

    expect(result.content).toBe('name,plan\nAlice,Pro');
  });

  it('normalizes json documents', async () => {
    const result = await service.extract(
      createFile({
        originalname: 'policy.json',
        mimetype: 'application/json',
        content: '{"refundDays":30}',
      }),
    );

    expect(result.content).toBe('{\n  "refundDays": 30\n}');
  });

  it('strips html markup', async () => {
    const result = await service.extract(
      createFile({
        originalname: 'page.html',
        mimetype: 'text/html',
        content: '<h1>Terms</h1><script>ignored()</script><p>Pay &amp; go</p>',
      }),
    );

    expect(result.content).toBe('Terms Pay & go');
  });

  it('rejects empty files', async () => {
    await expect(
      service.extract(
        createFile({
          originalname: 'empty.txt',
          mimetype: 'text/plain',
          content: '',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unsupported file types', async () => {
    await expect(
      service.extract(
        createFile({
          originalname: 'archive.zip',
          mimetype: 'application/zip',
          content: 'zip bytes',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function createFile(input: {
  originalname: string;
  mimetype: string;
  content: string;
}): Express.Multer.File {
  const buffer = Buffer.from(input.content);

  return {
    fieldname: 'file',
    originalname: input.originalname,
    encoding: '7bit',
    mimetype: input.mimetype,
    size: buffer.length,
    buffer,
    destination: '',
    filename: input.originalname,
    path: '',
    stream: undefined as never,
  };
}
