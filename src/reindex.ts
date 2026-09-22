import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { validateEnv } from './config/env.schema';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { SearchModule } from './search/search.module';
import { SearchService } from './search/search.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    PrismaModule,
    SearchModule,
  ],
})
class ReindexModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(ReindexModule);
  try {
    const search = app.get(SearchService);
    if (!search.enabled)
      throw new Error(
        'Set SEARCH_BACKEND=qdrant-elasticsearch before reindexing',
      );
    await search.ensureIndexes();
    const prisma = app.get(PrismaService);
    let cursor: string | undefined;
    let count = 0;
    while (true) {
      const documents = await prisma.document.findMany({
        where: { status: 'completed' },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (documents.length === 0) break;
      for (const document of documents) {
        await search.syncDocument(document.id);
        count++;
      }
      cursor = documents[documents.length - 1].id;
    }
    console.log(
      `Indexed ${count} completed documents in Qdrant and Elasticsearch`,
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Reindex failed');
  process.exitCode = 1;
});
