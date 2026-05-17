# Generated manually for sprint ML classification contract updates.

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chat_messages', '0003_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='MessageClassification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label', models.CharField(max_length=50)),
                ('confidence', models.FloatField(default=0)),
                ('probabilities', models.JSONField(blank=True, default=dict)),
                ('classified_at', models.DateTimeField(default=django.utils.timezone.now)),
                (
                    'message',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='classification',
                        to='chat_messages.message',
                    ),
                ),
            ],
            options={
                'ordering': ['-classified_at'],
            },
        ),
    ]
