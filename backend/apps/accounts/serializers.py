from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate
from .models import StaffProfile, StaffPermission
from .permissions_helper import get_user_permissions

User = get_user_model()


def build_public_media_url(request, path):
    if not path:
        return None

    public_origin = ''
    if request:
        public_origin = (
            request.headers.get('x-public-origin')
            or request.META.get('HTTP_X_PUBLIC_ORIGIN')
            or ''
        ).strip()

    if public_origin:
        public_origin = public_origin.rstrip('/')
        return f'{public_origin}{path}'

    if request:
        return request.build_absolute_uri(path)

    return path


class StaffProfileDetailSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = StaffProfile
        fields = [
            'id', 'tier', 'designation', 'department', 'phone',
            'photo', 'photo_url', 'linkedin_url', 'profile_url',
            'scholar_url', 'order', 'is_public'
        ]

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            return build_public_media_url(request, obj.photo.url)
        return None


class StaffDirectorySerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    user_id = serializers.UUIDField(source='user.id', read_only=True)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = StaffProfile
        fields = [
            'id', 'user_id', 'full_name', 'first_name', 'last_name', 'email',
            'tier', 'designation', 'department', 'phone', 'photo_url',
            'linkedin_url', 'profile_url', 'scholar_url', 'order'
        ]

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            return build_public_media_url(request, obj.photo.url)
        return None


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    profile_photo_url = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    staff_profile = StaffProfileDetailSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'phone', 'affiliation', 'bio', 'designation', 'gender',
            'research_interests', 'profile_photo', 'profile_photo_url',
            'registration_id', 'must_change_password', 'profile_complete',
            'show_phone', 'show_linkedin', 'linkedin_url', 'created_at',
            'warning_note', 'warning_acknowledged', 'warning_acknowledged_at',
            'warning_response', 'suspended_reason', 'permissions', 'staff_profile'
        ]
        read_only_fields = [
            'id', 'email', 'role', 'registration_id', 'created_at',
            'warning_note', 'warning_acknowledged', 'warning_acknowledged_at',
            'warning_response', 'suspended_reason', 'permissions', 'staff_profile'
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_profile_photo_url(self, obj):
        if obj.profile_photo:
            request = self.context.get('request')
            return build_public_media_url(request, obj.profile_photo.url)
        if hasattr(obj, 'staff_profile') and obj.staff_profile and obj.staff_profile.photo:
            request = self.context.get('request')
            return build_public_media_url(request, obj.staff_profile.photo.url)
        return None

    def get_permissions(self, obj):
        return get_user_permissions(obj)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            raise serializers.ValidationError('Email and password are required.')

        try:
            u = User.objects.get(email=email)
            if not u.is_active:
                reason = u.suspended_reason or 'Contact the organizers.'
                raise serializers.ValidationError(f'Account suspended: {reason}')
        except User.DoesNotExist:
            raise serializers.ValidationError('Invalid email or password.')

        user = authenticate(email=email, password=password)
        if not user:
            raise serializers.ValidationError('Invalid email or password.')

        data['user'] = user
        return data


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)

    def validate_new_password(self, value):
        return value


class StaffPermissionMatrixSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    tier = serializers.CharField(source='staff_profile.tier', read_only=True, default='')
    designation = serializers.CharField(source='staff_profile.designation', read_only=True, default='')
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'role', 'tier', 'designation', 'permissions']

    def get_permissions(self, obj):
        return list(StaffPermission.objects.filter(user=obj).values_list('module', flat=True))
