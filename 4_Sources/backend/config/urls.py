"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from chats.views import ChatMemberViewSet, ChatViewSet
from messages.views import MessageViewSet, SemanticSearchView
from users.views import AdminEmailBroadcastView, AdminEventsView, ConfirmRegistrationView, ContactViewSet, CurrentUserView, EmailOrUsernameAuthTokenView, PasswordResetConfirmView, PasswordResetRequestView, RegisterView, UserSearchViewSet, UserViewSet

router = DefaultRouter()
router.register('users', UserViewSet)
router.register('user-search', UserSearchViewSet, basename='user-search')
router.register('contacts', ContactViewSet, basename='contact')
router.register('chats', ChatViewSet, basename='chat')
router.register('chat-members', ChatMemberViewSet, basename='chat-member')
router.register('messages', MessageViewSet, basename='message')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/auth/', include('rest_framework.urls')),
    path('api/auth/token/', EmailOrUsernameAuthTokenView.as_view(), name='api-token-auth'),
    path('api/register/', RegisterView.as_view(), name='api-register'),
    path('api/register/confirm/<uidb64>/<token>/', ConfirmRegistrationView.as_view(), name='api-register-confirm'),
    path('api/password-reset/', PasswordResetRequestView.as_view(), name='api-password-reset'),
    path('api/password-reset/confirm/', PasswordResetConfirmView.as_view(), name='api-password-reset-confirm'),
    path('api/me/', CurrentUserView.as_view(), name='api-me'),
    path('api/search/semantic/', SemanticSearchView.as_view(), name='api-search-semantic'),
    path('api/admin/events/', AdminEventsView.as_view(), name='api-admin-events'),
    path('api/admin/email/broadcast/', AdminEmailBroadcastView.as_view(), name='api-admin-email-broadcast'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

try:
    from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
except ImportError:
    pass
else:
    urlpatterns += [
        path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
        path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    ]
