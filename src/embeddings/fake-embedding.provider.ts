import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmbeddingInput, EmbeddingProvider } from './embedding-provider';

@Injectable()
export class FakeEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly configService: ConfigService) {}

  embed(input: EmbeddingInput): Promise<number[]> {
    const dimensions = this.configService.getOrThrow<number>(
      'EMBEDDING_DIMENSIONS',
    );
    const vector = new Array<number>(dimensions).fill(0);

    for (let index = 0; index < input.text.length; index += 1) {
      const charCode = input.text.charCodeAt(index);
      const bucket = index % dimensions;

      vector[bucket] += charCode / 1000;
    }

    const magnitude = Math.sqrt(
      vector.reduce((sum, value) => sum + value * value, 0),
    );

    if (magnitude === 0) {
      return Promise.resolve(vector);
    }

    return Promise.resolve(
      vector.map((value) => Number((value / magnitude).toFixed(6))),
    );
  }
}
