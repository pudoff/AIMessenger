from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers

from .models import Contact, User


class PublicUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'phone_number', 'role')
        read_only_fields = fields


class EmailOrUsernameAuthTokenSerializer(serializers.Serializer):
    username = serializers.CharField(label='Логин или e-mail', write_only=True)
    password = serializers.CharField(
        label='Пароль',
        style={'input_type': 'password'},
        trim_whitespace=False,
        write_only=True,
    )

    def validate(self, attrs):
        identifier = attrs.get('username')
        password = attrs.get('password')

        if not identifier or not password:
            raise serializers.ValidationError(
                'Введите логин или e-mail и пароль.',
                code='authorization',
            )

        username = identifier
        if '@' in identifier:
            user_by_email = User.objects.filter(email__iexact=identifier).first()
            if user_by_email:
                username = user_by_email.get_username()

        user = authenticate(
            request=self.context.get('request'),
            username=username,
            password=password,
        )

        if not user:
            raise serializers.ValidationError(
                'Невозможно войти с предоставленными учетными данными.',
                code='authorization',
            )

        attrs['user'] = user
        return attrs


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
        return User.objects.create_user(is_active=False, **validated_data)


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


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uidb64 = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Пароли не совпадают.'})

        try:
            user_id = force_str(urlsafe_base64_decode(attrs['uidb64']))
            user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError({'token': 'Ссылка восстановления недействительна.'})

        if not default_token_generator.check_token(user, attrs['token']):
            raise serializers.ValidationError({'token': 'Ссылка восстановления недействительна.'})

        attrs['user'] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data['user']
        user.set_password(self.validated_data['password'])
        user.save(update_fields=['password'])
        return user


class CurrentUserSerializer(serializers.ModelSerializer):
    current_password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, required=False, validators=[validate_password])
    avatar_url = serializers.SerializerMethodField()

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
            'avatar',
            'avatar_url',
            'accepted_user_agreement',
            'accepted_privacy_policy',
            'role',
            'current_password',
            'new_password',
        )
        read_only_fields = (
            'id',
            'username',
            'accepted_user_agreement',
            'accepted_privacy_policy',
            'role',
            'avatar_url',
        )

    def get_avatar_url(self, obj):
        request = self.context.get('request')
        if not obj.avatar:
            return None
        return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url

    def validate(self, attrs):
        new_password = attrs.get('new_password')
        current_password = attrs.get('current_password')
        if new_password and not current_password:
            raise serializers.ValidationError({'current_password': 'Введите текущий пароль.'})
        if new_password and not self.instance.check_password(current_password):
            raise serializers.ValidationError({'current_password': 'Текущий пароль указан неверно.'})
        return attrs

    def update(self, instance, validated_data):
        new_password = validated_data.pop('new_password', None)
        validated_data.pop('current_password', None)
        avatar = validated_data.pop('avatar', serializers.empty)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if avatar is not serializers.empty:
            if avatar in (None, '') and instance.avatar:
                instance.avatar.delete(save=False)
                instance.avatar = None
            else:
                instance.avatar = avatar
        if new_password:
            instance.set_password(new_password)
        instance.save()
        return instance


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
