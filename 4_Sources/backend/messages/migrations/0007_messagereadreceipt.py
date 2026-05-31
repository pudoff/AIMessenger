import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('chats', '0003_chat_chat_type_chat_created_by_chat_description'),
        ('chat_messages', '0006_ensure_pgvector_column'),
    ]

    operations = [
        migrations.CreateModel(
            name='MessageReadReceipt',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('last_read_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('chat', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='read_receipts', to='chats.chat')),
                ('last_read_message', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='read_receipts', to='chat_messages.message')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='message_read_receipts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-last_read_at'],
                'indexes': [
                    models.Index(fields=['chat', 'user'], name='chat_messag_chat_id_b08916_idx'),
                    models.Index(fields=['user', 'last_read_at'], name='chat_messag_user_id_60b80f_idx'),
                ],
                'constraints': [
                    models.UniqueConstraint(fields=('chat', 'user'), name='unique_chat_read_receipt'),
                ],
            },
        ),
    ]
