import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createExtension('vector', {
    ifNotExists: true,
  });

  pgm.addColumn('document_chunks', {
    embedding: {
      type: 'vector(1536)',
    },
  });

  pgm.sql(`
    CREATE INDEX document_chunks_embedding_hnsw_index
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP INDEX IF EXISTS document_chunks_embedding_hnsw_index');

  pgm.dropColumn('document_chunks', 'embedding');
}
