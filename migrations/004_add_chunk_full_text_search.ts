import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('document_chunks', {
    search_vector: {
      type: 'tsvector',
    },
  });

  pgm.sql(`
    UPDATE document_chunks
    SET search_vector = to_tsvector('english', content)
  `);

  pgm.sql(`
    CREATE INDEX document_chunks_search_vector_index
    ON document_chunks
    USING GIN (search_vector)
  `);

  pgm.sql(`
    CREATE FUNCTION document_chunks_search_vector_update()
    RETURNS trigger AS $$
    BEGIN
      NEW.search_vector := to_tsvector('english', NEW.content);
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql
  `);

  pgm.sql(`
    CREATE TRIGGER document_chunks_search_vector_trigger
    BEFORE INSERT OR UPDATE OF content
    ON document_chunks
    FOR EACH ROW
    EXECUTE FUNCTION document_chunks_search_vector_update()
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TRIGGER IF EXISTS document_chunks_search_vector_trigger
    ON document_chunks
  `);

  pgm.sql(`
    DROP FUNCTION IF EXISTS document_chunks_search_vector_update
  `);

  pgm.sql(`
    DROP INDEX IF EXISTS document_chunks_search_vector_index
  `);

  pgm.dropColumn('document_chunks', 'search_vector');
}
