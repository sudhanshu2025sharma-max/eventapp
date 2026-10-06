from rest_framework import serializers
from .models import Speaker, SpeakerTalk


class SpeakerTalkSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SpeakerTalk
        fields = ['id', 'title', 'abstract', 'track', 'talk_date', 'talk_time', 'display_order']


class SpeakerListSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    full_name = serializers.CharField(read_only=True)
    initials  = serializers.CharField(read_only=True)
    talk_count = serializers.SerializerMethodField()
    user_id = serializers.ReadOnlyField(source='user.id')

    class Meta:
        model  = Speaker
        fields = [
            'id', 'user_id', 'full_name', 'initials', 'title', 'first_name', 'last_name',
            'designation', 'institute', 'country',
            'photo_url', 'is_keynote', 'display_order', 'talk_count',
        ]

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None

    def get_talk_count(self, obj):
        return obj.talks.count()


class SpeakerDetailSerializer(serializers.ModelSerializer):
    photo_url  = serializers.SerializerMethodField()
    full_name  = serializers.CharField(read_only=True)
    initials   = serializers.CharField(read_only=True)
    talks      = SpeakerTalkSerializer(many=True, read_only=True)
    user_id    = serializers.ReadOnlyField(source='user.id')

    class Meta:
        model  = Speaker
        fields = [
            'id', 'user_id', 'full_name', 'initials', 'title', 'first_name', 'last_name',
            'designation', 'institute', 'country', 'bio',
            'photo_url',
            'email', 'website_url', 'linkedin_url', 'google_scholar_url',
            'researchgate_url', 'twitter_url',
            'is_keynote', 'display_order',
            'talks',
            'created_at', 'updated_at',
        ]

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None
