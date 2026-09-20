import { Module } from '@nestjs/common';

import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueryController } from './query.controller';
import { QueryRepository } from './query.repository';
import { QueryService } from './query.service';

@Module({
  imports: [PrismaModule, EmbeddingsModule, LlmModule],
  controllers: [QueryController],
  providers: [QueryService, QueryRepository],
})
export class QueryModule {}
