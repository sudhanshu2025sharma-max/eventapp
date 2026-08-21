from rest_framework import serializers
from .models import Sponsor


class SponsorListSerializer(serializers.ModelSerializer):
    """Lightweight — used for the grid on the main sponsors screen."""
    logo_url = serializers.SerializerMethodField()
    stall_photo_url = serializers.SerializerMethodField()
    tier_display = serializers.CharField(source='get_tier_display', read_only=True)

    class Meta:
        model = Sponsor
        fields = [
            'id', 'name', 'tier', 'tier_display', 'logo_url', 'website_url', 'display_order',
            'latitude', 'longitude', 'stall_number', 'stall_photo_url',
            'contact_person_name', 'contact_person_role',
        ]

    def get_logo_url(self, obj):
        req = self.context.get('request')
        if obj.logo and req:
            return req.build_absolute_uri(obj.logo.url)
        if obj.logo:
            return obj.logo.url
        return None

    def get_stall_photo_url(self, obj):
        req = self.context.get('request')
        if obj.stall_photo and req:
            return req.build_absolute_uri(obj.stall_photo.url)
        if obj.stall_photo:
            return obj.stall_photo.url
        return None


class SponsorDetailSerializer(serializers.ModelSerializer):
    """Full detail — used for Platinum sponsor dedicated pages."""
    logo_url = serializers.SerializerMethodField()
    stall_photo_url = serializers.SerializerMethodField()
    tier_display = serializers.CharField(source='get_tier_display', read_only=True)

    class Meta:
        model = Sponsor
        fields = [
            'id', 'name', 'tier', 'tier_display', 'logo_url',
            'description', 'website_url',
            'contact_email', 'contact_phone', 'address',
            'contact_person_name', 'contact_person_role',
            'latitude', 'longitude', 'stall_number', 'stall_photo_url',
            'linkedin_url', 'twitter_url', 'facebook_url', 'instagram_url', 'youtube_url',
            'partnership_details', 'display_order', 'is_active',
            'created_at', 'updated_at',
        ]

    def get_logo_url(self, obj):
        req = self.context.get('request')
        if obj.logo and req:
            return req.build_absolute_uri(obj.logo.url)
        if obj.logo:
            return obj.logo.url
        return None

    def get_stall_photo_url(self, obj):
        req = self.context.get('request')
        if obj.stall_photo and req:
            return req.build_absolute_uri(obj.stall_photo.url)
        if obj.stall_photo:
            return obj.stall_photo.url
        return None
