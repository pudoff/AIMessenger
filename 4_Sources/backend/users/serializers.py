from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Contact, User


class PublicUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'phone_number', 'role')
        read_only_fields = fields


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'birth_date',
            'phone_number',
            'accepted_user_agreement',
            'accepted_privacy_policy',
            'user_agreement_accepted_at',
            'privacy_policy_accepted_at',
            'blocked_until',
            'role',
            'is_active',
            'password',
        )
        read_only_fields = (
            'id',
            'user_agreement_accepted_at',
            'privacy_policy_accepted_at',
        )

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    email = serializers.EmailField(required=True)
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)
    birth_date = serializers.DateField(required=True)
    phone_number = serializers.CharField(required=True)
    accepted_user_agreement = serializers.BooleanField(required=True)
    accepted_privacy_policy = serializers.BooleanField(required=True)

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'password',
            'email',
            'first_name',
            'last_name',
            'birth_date',
            'phone_number',
            'accepted_user_agreement',
            'accepted_privacy_policy',
            'role',
        )
        read_only_fields = ('id', 'role')

    def validate_accepted_user_agreement(self, value):
        if not value:
            raise serializers.ValidationError('Необходимо принять пользовательское соглашение.')
        return value

    def validate_accepted_privacy_policy(self, value):
        if not value:
            raise serializers.ValidationError('Необходимо принять политику конфиденциальности.')
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Пользователь с таким email уже существует.')
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class AdminEmailBroadcastSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=255)
    message = serializers.CharField()
    emails = serializers.ListField(
        child=serializers.EmailField(),
        required=False,
        allow_empty=True,
    )
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
    )

    def get_recipients(self):
        data = self.validated_data
        recipients = list(data.get('emails') or [])
        user_ids = data.get('user_ids') or []

        users = User.objects.filter(is_active=True).exclude(email='')
        if user_ids:
            users = users.filter(id__in=user_ids)
        elif recipients:
            users = User.objects.none()

        recipients.extend(users.values_list('email', flat=True))
        return sorted(set(recipients))


class CurrentUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'birth_date',
            'phone_number',
            'accepted_user_agreement',
            'accepted_privacy_policy',
            'role',
        )
        read_only_fields = fields


class ContactSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(read_only=True)
    contact_detail = PublicUserSerializer(source='contact', read_only=True)

    class Meta:
        model = Contact
        fields = ('id', 'owner', 'contact', 'contact_detail', 'created_at')
        read_only_fields = ('id', 'owner', 'contact_detail', 'created_at')

    def validate_contact(self, contact):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            if contact.id == user.id:
                raise serializers.ValidationError('Нельзя добавить себя в контакты.')
            queryset = Contact.objects.filter(owner=user, contact=contact)
            if self.instance:
                queryset = queryset.exclude(id=self.instance.id)
            if queryset.exists():
                raise serializers.ValidationError('Пользователь уже есть в ваших контактах.')
        return contact
