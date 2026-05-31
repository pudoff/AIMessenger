from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0003_contact'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='avatar',
            field=models.FileField(blank=True, null=True, upload_to='avatars/%Y/%m/%d/'),
        ),
    ]
