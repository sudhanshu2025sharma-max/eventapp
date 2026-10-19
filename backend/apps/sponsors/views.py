from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from collections import OrderedDict

from .models import Sponsor
from .serializers import SponsorListSerializer, SponsorDetailSerializer


def _public_media_url(request, path):
    if not path:
        return None
    public_origin = (
        request.headers.get('x-public-origin')
        or request.META.get('HTTP_X_PUBLIC_ORIGIN')
        or ''
    ).strip()
    if public_origin:
        return public_origin.rstrip('/') + path
    try:
        return request.build_absolute_uri(path)
    except Exception:
        return path




TIER_ORDER = ['national_funding', 'platinum', 'gold', 'silver', 'bronze', 'academic_partner', 'media_partner', 'other']


@api_view(['GET'])
@permission_classes([AllowAny])
def list_sponsors(request):
    """Return sponsors grouped by tier for the mobile app."""
    qs = Sponsor.objects.filter(is_active=True).order_by('display_order', 'name')
    serializer = SponsorListSerializer(qs, many=True, context={'request': request})

    tier_choices_dict = dict(Sponsor.TIER_CHOICES)
    grouped = OrderedDict()

    # Pre-populate ordered tiers
    for tier in TIER_ORDER:
        grouped[tier] = {
            'tier': tier,
            'tier_display': tier_choices_dict.get(tier, tier.replace('_', ' ').title()),
            'sponsors': [],
        }

    for s in serializer.data:
        tier = s['tier']
        if tier not in grouped:
            grouped[tier] = {
                'tier': tier,
                'tier_display': tier_choices_dict.get(tier, tier.replace('_', ' ').title()),
                'sponsors': [],
            }
        grouped[tier]['sponsors'].append(s)

    # Return only tiers that actually have sponsors (or standard empty groups)
    active_groups = [g for g in grouped.values() if len(g['sponsors']) > 0]
    return Response({'groups': active_groups})


@api_view(['GET'])
@permission_classes([AllowAny])
def sponsor_detail(request, sponsor_id):
    try:
        sponsor = Sponsor.objects.get(pk=sponsor_id, is_active=True)
    except Sponsor.DoesNotExist:
        return Response({'error': 'Sponsor not found'}, status=404)
    serializer = SponsorDetailSerializer(sponsor, context={'request': request})
    return Response(serializer.data)
