from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

try:
    from pgvector.django.indexes import HnswIndex
    from pgvector.django.vector import VectorField
except ImportError:
    HnswIndex = None

    class VectorField(models.JSONField):
        def __init__(self, *args, dimensions=None, **kwargs):
            self.dimensions = dimensions
            super().__init__(*args, **kwargs)

        def deconstruct(self):
            name, path, args, kwargs = super().deconstruct()
            kwargs.pop("dimensions", None)
            return name, "django.db.models.JSONField", args, kwargs


def enable_pgvector(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute('CREATE EXTENSION IF NOT EXISTS vector')


operations = [
        migrations.RunPython(enable_pgvector, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='messageclassification',
            name='label',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='messageclassification',
            name='error_message',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='messageclassification',
            name='needs_review',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='messageclassification',
            name='source',
            field=models.CharField(choices=[('mock', 'Mock'), ('ml_worker', 'ML worker'), ('fallback', 'Fallback')], default='ml_worker', max_length=20),
        ),
        migrations.AddField(
            model_name='messageclassification',
            name='status',
            field=models.CharField(choices=[('pending', 'Pending'), ('completed', 'Completed'), ('failed', 'Failed')], default='pending', max_length=20),
        ),
        migrations.CreateModel(
            name='MessageEmbedding',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('vector', VectorField(dimensions=getattr(settings, 'EMBEDDING_DIMENSIONS', 384))),
                ('text_hash', models.CharField(db_index=True, max_length=64)),
                ('model_name', models.CharField(max_length=255)),
                ('dimensions', models.PositiveIntegerField(default=getattr(settings, 'EMBEDDING_DIMENSIONS', 384))),
                ('source', models.CharField(default='ml_worker', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('message', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='embedding', to='chat_messages.message')),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
]

if HnswIndex is not None:
    operations.append(
        migrations.AddIndex(
            model_name='messageembedding',
            index=HnswIndex(
                ef_construction=64,
                fields=['vector'],
                m=16,
                name='message_embedding_hnsw_idx',
                opclasses=['vector_cosine_ops'],
            ),
        )
    )


class Migration(migrations.Migration):

    dependencies = [
        ('chat_messages', '0004_messageclassification'),
    ]

    operations = operations
