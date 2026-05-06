from rest_framework import generics, viewsets
from rest_framework.permissions import AllowAny

from .models import User
from .permissions import IsProjectAdminUser
from .serializers import CurrentUserSerializer, RegisterSerializer, UserSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('id')
    serializer_class = UserSerializer
    permission_classes = (IsProjectAdminUser,)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = (AllowAny,)


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = CurrentUserSerializer

    def get_object(self):
        return self.request.user
