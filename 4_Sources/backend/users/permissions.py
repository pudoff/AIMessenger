from rest_framework import permissions

from .models import User


def is_project_admin(user):
    return bool(
        user
        and user.is_authenticated
        and (
            user.is_staff
            or user.is_superuser
            or user.role == User.Role.ADMIN
        )
    )


class IsProjectAdminUser(permissions.BasePermission):
    """Allow access to Django admins and users with the project admin role."""

    def has_permission(self, request, view):
        return is_project_admin(request.user)
