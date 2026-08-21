from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.views.decorators.http import require_http_methods

from apps.accounts.admin_views import admin_required
from .models import Sponsor


@admin_required
def sponsors_panel(request):
    tier_filter = request.GET.get('tier', '')
    qs = Sponsor.objects.all().order_by('tier', 'display_order', 'name')
    if tier_filter:
        qs = qs.filter(tier=tier_filter)

    tiers = Sponsor.TIER_CHOICES

    grouped = {}
    for t, label in tiers:
        grouped[t] = {'label': label, 'items': []}
    for s in qs:
        if s.tier in grouped:
            grouped[s.tier]['items'].append(s)

    context = {
        'tiers': tiers,
        'grouped': grouped,
        'tier_filter': tier_filter,
        'total': Sponsor.objects.count(),
        'active_count': Sponsor.objects.filter(is_active=True).count(),
    }
    return render(request, 'panel/sponsors_list.html', context)


@admin_required
@require_http_methods(['GET', 'POST'])
def sponsor_create(request):
    if request.method == 'POST':
        try:
            s = Sponsor.objects.create(
                name=request.POST.get('name', '').strip(),
                tier=request.POST.get('tier', 'bronze'),
                description=request.POST.get('description', '').strip(),
                website_url=request.POST.get('website_url', '').strip(),
                contact_email=request.POST.get('contact_email', '').strip(),
                contact_phone=request.POST.get('contact_phone', '').strip(),
                address=request.POST.get('address', '').strip(),
                linkedin_url=request.POST.get('linkedin_url', '').strip(),
                twitter_url=request.POST.get('twitter_url', '').strip(),
                facebook_url=request.POST.get('facebook_url', '').strip(),
                instagram_url=request.POST.get('instagram_url', '').strip(),
                youtube_url=request.POST.get('youtube_url', '').strip(),
                partnership_details=request.POST.get('partnership_details', '').strip(),
                display_order=int(request.POST.get('display_order') or 0),
                is_active=request.POST.get('is_active') == 'on',
                stall_number=request.POST.get('stall_number', '').strip(),
                contact_person_name=request.POST.get('contact_person_name', '').strip(),
                contact_person_role=request.POST.get('contact_person_role', '').strip(),
                latitude=request.POST.get('latitude') or None,
                longitude=request.POST.get('longitude') or None,
            )
            if 'logo' in request.FILES:
                s.logo = request.FILES['logo']
            if 'stall_photo' in request.FILES:
                s.stall_photo = request.FILES['stall_photo']
            s.save()
            messages.success(request, f'Sponsor "{s.name}" added.')
            return redirect('sponsors_panel')
        except Exception as e:
            messages.error(request, f'Error: {e}')

    return render(request, 'panel/sponsor_form.html', {
        'sponsor': None,
        'tiers': Sponsor.TIER_CHOICES,
        'mode': 'create',
    })


@admin_required
@require_http_methods(['GET', 'POST'])
def sponsor_edit(request, sponsor_id):
    s = get_object_or_404(Sponsor, pk=sponsor_id)

    if request.method == 'POST':
        try:
            s.name = request.POST.get('name', '').strip()
            s.tier = request.POST.get('tier', s.tier)
            s.description = request.POST.get('description', '').strip()
            s.website_url = request.POST.get('website_url', '').strip()
            s.contact_email = request.POST.get('contact_email', '').strip()
            s.contact_phone = request.POST.get('contact_phone', '').strip()
            s.address = request.POST.get('address', '').strip()
            s.linkedin_url = request.POST.get('linkedin_url', '').strip()
            s.twitter_url = request.POST.get('twitter_url', '').strip()
            s.facebook_url = request.POST.get('facebook_url', '').strip()
            s.instagram_url = request.POST.get('instagram_url', '').strip()
            s.youtube_url = request.POST.get('youtube_url', '').strip()
            s.partnership_details = request.POST.get('partnership_details', '').strip()
            s.display_order = int(request.POST.get('display_order') or 0)
            s.is_active = request.POST.get('is_active') == 'on'
            s.stall_number = request.POST.get('stall_number', '').strip()
            s.contact_person_name = request.POST.get('contact_person_name', '').strip()
            s.contact_person_role = request.POST.get('contact_person_role', '').strip()
            s.latitude = request.POST.get('latitude') or None
            s.longitude = request.POST.get('longitude') or None

            if 'logo' in request.FILES:
                s.logo = request.FILES['logo']
            if 'stall_photo' in request.FILES:
                s.stall_photo = request.FILES['stall_photo']

            s.save()
            messages.success(request, f'Sponsor "{s.name}" updated.')
            return redirect('sponsors_panel')
        except Exception as e:
            messages.error(request, f'Error: {e}')

    return render(request, 'panel/sponsor_form.html', {
        'sponsor': s,
        'tiers': Sponsor.TIER_CHOICES,
        'mode': 'edit',
    })


@admin_required
@require_http_methods(['POST'])
def sponsor_delete(request, sponsor_id):
    s = get_object_or_404(Sponsor, pk=sponsor_id)
    name = s.name
    s.delete()
    messages.success(request, f'Sponsor "{name}" deleted.')
    return redirect('sponsors_panel')
