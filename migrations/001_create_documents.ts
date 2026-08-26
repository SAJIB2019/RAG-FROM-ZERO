import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('documents', {
    id: {
      type: 'uuid',
      primaryKey: true,
    },
    filename: {
      type: 'text',
      notNull: true,
    },
    mime_type: {
      type: 'text',
      notNull: true,
    },
    source: {
      type: 'text',
    },
    status: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('documents', ['status']);
  pgm.createIndex('documents', ['created_at']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('documents');
}
