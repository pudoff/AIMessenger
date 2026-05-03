from rest_framework import viewsets

from .models import Chat, ChatMember
from .serializers import ChatMemberSerializer, ChatSerializer


class ChatViewSet(viewsets.ModelViewSet):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer


class ChatMemberViewSet(viewsets.ModelViewSet):
    queryset = ChatMember.objects.select_related('chat', 'user')
    serializer_class = ChatMemberSerializer
