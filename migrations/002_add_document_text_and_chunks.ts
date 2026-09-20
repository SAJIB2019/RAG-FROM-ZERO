import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('documents', {
    raw_text: {
      type: 'text',
    },
  });

  pgm.createTable('document_chunks', {
    id: {
      type: 'uuid',
      primaryKey: true,
    },
    document_id: {
      type: 'uuid',
      notNull: true,
      references: '"documents"',
      onDelete: 'cascade',
    },
    chunk_index: {
      type: 'integer',
      notNull: true,
    },
    content: {
      type: 'text',
      notNull: true,
    },
    token_count: {
      type: 'integer',
      notNull: true,
    },
    metadata: {
      type: 'jsonb',
      notNull: true,
      default: '{}',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('document_chunks', ['document_id']);
  pgm.createIndex('document_chunks', ['document_id', 'chunk_index'], {
    unique: true,
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('document_chunks');
  pgm.dropColumn('documents', 'raw_text');
}
