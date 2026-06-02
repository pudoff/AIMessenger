from django.core.management.base import BaseCommand

from messages.models import Message
from messages.tasks import build_message_embedding_task, text_hash


class Command(BaseCommand):
    help = "Rebuild missing or stale message embeddings."

    def add_arguments(self, parser):
        parser.add_argument("--sync", action="store_true", help="Run tasks in-process instead of queueing Celery jobs.")

    def handle(self, *args, **options):
        queued = 0
        skipped = 0
        for message in Message.objects.select_related("embedding").iterator():
            current_hash = text_hash(message.text)
            embedding = getattr(message, "embedding", None)
            if embedding and embedding.text_hash == current_hash:
                skipped += 1
                continue
            if options["sync"]:
                build_message_embedding_task.run(message.id)
            else:
                build_message_embedding_task.apply_async(args=[message.id])
            queued += 1

        self.stdout.write(self.style.SUCCESS(f"Embeddings queued: {queued}; skipped: {skipped}"))
