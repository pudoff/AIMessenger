from django.conf import settings
from django.db import migrations


TABLE_NAME = 'chat_messages_messageembedding'
COLUMN_NAME = 'vector'
INDEX_NAME = 'message_embedding_hnsw_idx'


def ensure_pgvector_column(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return

    dimensions = getattr(settings, 'EMBEDDING_DIMENSIONS', 384)
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT udt_name
            FROM information_schema.columns
            WHERE table_name = %s AND column_name = %s
            """,
            [TABLE_NAME, COLUMN_NAME],
        )
        row = cursor.fetchone()
        if not row:
            return

        if row[0] != 'vector':
            cursor.execute(f'CREATE EXTENSION IF NOT EXISTS vector')
            cursor.execute(
                f'''
                ALTER TABLE {TABLE_NAME}
                ALTER COLUMN "{COLUMN_NAME}" TYPE vector({dimensions})
                USING "{COLUMN_NAME}"::text::vector({dimensions})
                '''
            )

        cursor.execute(
            f'''
            CREATE INDEX IF NOT EXISTS {INDEX_NAME}
            ON {TABLE_NAME}
            USING hnsw ("{COLUMN_NAME}" vector_cosine_ops)
            '''
        )


class Migration(migrations.Migration):

    dependencies = [
        ('chat_messages', '0005_async_ml_and_embeddings'),
    ]

    operations = [
        migrations.RunPython(ensure_pgvector_column, migrations.RunPython.noop),
    ]
