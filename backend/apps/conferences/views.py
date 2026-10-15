from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from .models import ConferenceSetting
from apps.events.models import Event


from django.core.cache import cache
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

@receiver([post_save, post_delete], sender=ConferenceSetting)
def _on_conf_settings_change(sender, **kwargs):
    cache.delete('conf_settings_payload_v1')


# ── public API ────────────────────────────────────────────────────────────

def conference_settings(request):
    data = cache.get('conf_settings_payload_v1')
    if data is None:
        s = ConferenceSetting.get()
        logo_url = request.build_absolute_uri(s.logo.url) if s.logo else None
        data = {
            'name':        s.name,
            'tagline':     s.tagline,
            'website_url': s.website_url,
            'logo_url':    logo_url,
            'start_date':  s.start_date.isoformat() if s.start_date else None,
            'end_date':    s.end_date.isoformat()   if s.end_date   else None,
            'venue':       s.venue,
        }
        cache.set('conf_settings_payload_v1', data, 300)
    return JsonResponse(data)


def events_api(request):
    events = list(Event.objects.filter(is_active=True).values(
        'id', 'title', 'event_type', 'day',
        'start_time', 'end_time', 'room', 'speaker',
    ))
    return JsonResponse({'events': events}, json_dumps_params={'default': str})


def events_today_api(request):
    s = ConferenceSetting.get()
    if s.start_date:
        day_num = (timezone.now().date() - s.start_date).days + 1
    else:
        day_num = 1
    day_num = max(1, day_num)
    events = list(Event.objects.filter(is_active=True, day=day_num).values(
        'id', 'title', 'event_type', 'day',
        'start_time', 'end_time', 'room', 'speaker',
    ))
    return JsonResponse({'day': day_num, 'events': events}, json_dumps_params={'default': str})


# ── admin panel ───────────────────────────────────────────────────────────

@login_required(login_url='/panel/login/')
def conference_settings_view(request):
    setting = ConferenceSetting.get()
    if request.method == 'POST':
        setting.name        = request.POST.get('name', setting.name).strip()
        setting.tagline     = request.POST.get('tagline', setting.tagline).strip()
        setting.website_url = request.POST.get('website_url', setting.website_url).strip()
        setting.venue       = request.POST.get('venue', setting.venue).strip()
        start = request.POST.get('start_date', '')
        end   = request.POST.get('end_date', '')
        if start: setting.start_date = start
        if end:   setting.end_date   = end
        if 'logo' in request.FILES:
            setting.logo = request.FILES['logo']
        setting.save()
        messages.success(request, 'Conference settings updated.')
        return redirect('conference_settings')
    return render(request, 'panel/conference_settings.html', {'setting': setting})


@login_required(login_url='/panel/login/')
def events_admin(request):
    all_events = Event.objects.all()
    days = sorted(set(all_events.values_list('day', flat=True))) or []
    grouped = {d: list(all_events.filter(day=d)) for d in days}
    return render(request, 'panel/events_list.html', {
        'grouped': grouped,
        'total': all_events.count(),
    })


@login_required(login_url='/panel/login/')
def event_create(request):
    if request.method == 'POST':
        Event.objects.create(
            title      = request.POST.get('title', '').strip(),
            event_type = request.POST.get('event_type', 'other'),
            day        = int(request.POST.get('day', 1)),
            start_time = request.POST.get('start_time'),
            end_time   = request.POST.get('end_time'),
            room       = request.POST.get('room', '').strip(),
            speaker    = request.POST.get('speaker', '').strip(),
        )
        messages.success(request, 'Event created.')
        return redirect('events_admin')
    return render(request, 'panel/event_form.html', {
        'event': None, 'types': Event.EventType.choices,
    })


@login_required(login_url='/panel/login/')
def event_edit(request, pk):
    event = get_object_or_404(Event, pk=pk)
    if request.method == 'POST':
        event.title      = request.POST.get('title', event.title).strip()
        event.event_type = request.POST.get('event_type', event.event_type)
        event.day        = int(request.POST.get('day', event.day))
        event.start_time = request.POST.get('start_time', event.start_time)
        event.end_time   = request.POST.get('end_time',   event.end_time)
        event.room       = request.POST.get('room',    event.room).strip()
        event.speaker    = request.POST.get('speaker', event.speaker).strip()
        event.is_active  = request.POST.get('is_active') == 'on'
        event.save()
        messages.success(request, 'Event updated.')
        return redirect('events_admin')
    return render(request, 'panel/event_form.html', {
        'event': event, 'types': Event.EventType.choices,
    })


@login_required(login_url='/panel/login/')
def event_delete(request, pk):
    get_object_or_404(Event, pk=pk).delete()
    messages.success(request, 'Event deleted.')
    return redirect('events_admin')
