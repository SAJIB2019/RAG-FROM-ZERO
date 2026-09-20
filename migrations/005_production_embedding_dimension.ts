import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP INDEX IF EXISTS document_chunks_embedding_index');
  pgm.sql('DROP INDEX IF EXISTS document_chunks_embedding_hnsw_index');

  // Existing development embeddings cannot be safely reshaped from 8 to 1536.
  pgm.sql(`
    ALTER TABLE document_chunks
    ALTER COLUMN embedding TYPE vector(1536)
    USING NULL
  `);

  pgm.sql(`
    CREATE INDEX document_chunks_embedding_hnsw_index
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP INDEX IF EXISTS document_chunks_embedding_hnsw_index');

  pgm.sql(`
    ALTER TABLE document_chunks
    ALTER COLUMN embedding TYPE vector(8)
    USING NULL
  `);

  pgm.sql(`
    CREATE INDEX document_chunks_embedding_index
    ON document_chunks
    USING ivfflat (embedding vector_cosine_ops)
  `);
}
