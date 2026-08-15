import json
from zoneinfo import ZoneInfo
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.accounts.admin_views import admin_required
from .models import (
    ScheduleSession, ScheduleSubSession, SESSION_TYPE,
    FeedbackForm, FeedbackQuestion, FeedbackResponse, FeedbackAnswer
)

IST = ZoneInfo("Asia/Kolkata")

def _parse_panel_dt(val):
    """
    Parse datetime-local input from admin panel.
    Treat naive values as IST, then convert to UTC for storage.
    """
    if not val:
        return None
    dt = parse_datetime(val)
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    return dt.astimezone(timezone.utc)


# ── Session List ─────────────────────────────────────────────────────────────

@admin_required
def schedule_panel(request):
    day_filter = request.GET.get('day', '')
    qs = ScheduleSession.objects.prefetch_related('sub_sessions', 'feedback_responses')
    if day_filter:
        qs = qs.filter(day=day_filter)

    stats = {
        'total':    ScheduleSession.objects.count(),
        'featured': ScheduleSession.objects.filter(is_featured=True).count(),
        'day1':     ScheduleSession.objects.filter(day=1).count(),
        'day2':     ScheduleSession.objects.filter(day=2).count(),
        'day3':     ScheduleSession.objects.filter(day=3).count(),
    }

    return render(request, 'panel/schedule_list.html', {
        'sessions':   qs,
        'day_filter': day_filter,
        'stats':      stats,
        'days':       [(1,'Day 1 — Oct 23'),(2,'Day 2 — Oct 24'),(3,'Day 3 — Oct 25')],
    })


# ── Session Create / Edit ────────────────────────────────────────────────────

@admin_required
@require_http_methods(['GET', 'POST'])
def session_create(request):
    if request.method == 'POST':
        try:
            sess = ScheduleSession.objects.create(
                day=int(request.POST['day']),
                title=request.POST['title'].strip(),
                session_type=request.POST.get('session_type', 'technical'),
                start_datetime=_parse_panel_dt(request.POST['start_datetime']),
                end_datetime=_parse_panel_dt(request.POST['end_datetime']),
                room=request.POST.get('room', '').strip(),
                description=request.POST.get('description', '').strip(),
                is_featured=request.POST.get('is_featured') == 'on',
                is_parallel=request.POST.get('is_parallel') == 'on',
                is_published=request.POST.get('is_published') == 'on',
                feedback_enabled=request.POST.get('feedback_enabled') == 'on',
                feedback_auto_open=request.POST.get('feedback_auto_open') == 'on',
                display_order=int(request.POST.get('display_order') or 0),
            )
            if sess.feedback_enabled:
                _ensure_feedback_form(sess)
            messages.success(request, f'Session "{sess.title}" created. You can now add sub-sessions.')
            return redirect('schedule_edit', pk=sess.pk)
        except Exception as e:
            messages.error(request, f'Error: {e}')

    return render(request, 'panel/schedule_form.html', {
        'session':       None,
        'mode':          'create',
        'session_types': SESSION_TYPE.choices,
        'days':          [(1,'Day 1'),(2,'Day 2'),(3,'Day 3')],
    })


@admin_required
@require_http_methods(['GET', 'POST'])
def session_edit(request, pk):
    sess = get_object_or_404(ScheduleSession, pk=pk)

    if request.method == 'POST':
        try:
            sess.day            = int(request.POST['day'])
            sess.title          = request.POST['title'].strip()
            sess.session_type   = request.POST.get('session_type', sess.session_type)
            sess.start_datetime = _parse_panel_dt(request.POST['start_datetime'])
            sess.end_datetime   = _parse_panel_dt(request.POST['end_datetime'])
            sess.room           = request.POST.get('room', '').strip()
            sess.description    = request.POST.get('description', '').strip()
            sess.is_featured    = request.POST.get('is_featured') == 'on'
            sess.is_parallel    = request.POST.get('is_parallel') == 'on'
            sess.is_published   = request.POST.get('is_published') == 'on'
            sess.feedback_enabled   = request.POST.get('feedback_enabled') == 'on'
            sess.feedback_auto_open = request.POST.get('feedback_auto_open') == 'on'
            sess.display_order  = int(request.POST.get('display_order') or 0)
            sess.save()
            if sess.feedback_enabled:
                _ensure_feedback_form(sess)
            messages.success(request, f'Session "{sess.title}" updated.')
            return redirect('schedule_panel')
        except Exception as e:
            messages.error(request, f'Error: {e}')

    return render(request, 'panel/schedule_form.html', {
        'session':       sess,
        'mode':          'edit',
        'session_types': SESSION_TYPE.choices,
        'days':          [(1,'Day 1'),(2,'Day 2'),(3,'Day 3')],
        'sub_sessions':  sess.sub_sessions.all(),
    })


@admin_required
@require_http_methods(['POST'])
def session_delete(request, pk):
    sess = get_object_or_404(ScheduleSession, pk=pk)
    title = sess.title
    sess.delete()
    messages.success(request, f'Session "{title}" deleted.')
    return redirect('schedule_panel')


# ── Sub-sessions (AJAX) ──────────────────────────────────────────────────────

@admin_required
@require_http_methods(['POST'])
def subsession_add(request, session_pk):
    sess = get_object_or_404(ScheduleSession, pk=session_pk)
    try:
        body = json.loads(request.body)
        sub  = ScheduleSubSession.objects.create(
            parent=sess,
            title=body['title'].strip(),
            start_datetime=_parse_panel_dt(body.get('start_datetime')) if body.get('start_datetime') else None,
            end_datetime=_parse_panel_dt(body.get('end_datetime')) if body.get('end_datetime') else None,
            description=body.get('description', '').strip(),
            display_order=int(body.get('display_order') or sess.sub_sessions.count() + 1),
        )
        return JsonResponse({'success': True, 'id': sub.id, 'title': sub.title})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@admin_required
@require_http_methods(['POST'])
def subsession_delete(request, pk):
    sub = get_object_or_404(ScheduleSubSession, pk=pk)
    sub.delete()
    return JsonResponse({'success': True})


# ── Feedback Form Management ─────────────────────────────────────────────────

@admin_required
def feedback_manage(request, session_pk):
    sess = get_object_or_404(ScheduleSession, pk=session_pk)
    form, _ = FeedbackForm.objects.get_or_create(
        session=sess,
        defaults={'title': f'Feedback: {sess.title}'}
    )
    questions    = form.questions.all()
    response_count = FeedbackResponse.objects.filter(session=sess).count()

    return render(request, 'panel/schedule_feedback.html', {
        'session':        sess,
        'form':           form,
        'questions':      questions,
        'response_count': response_count,
    })


@admin_required
@require_http_methods(['POST'])
def feedback_question_add(request, session_pk):
    sess = get_object_or_404(ScheduleSession, pk=session_pk)
    form, _ = FeedbackForm.objects.get_or_create(session=sess, defaults={'title': f'Feedback: {sess.title}'})
    try:
        body = json.loads(request.body)
        q = FeedbackQuestion.objects.create(
            form=form,
            question_text=body['question_text'].strip(),
            question_type=body.get('question_type', 'rating'),
            is_required=bool(body.get('is_required', True)),
            display_order=form.questions.count() + 1,
        )
        return JsonResponse({'success': True, 'id': q.id, 'text': q.question_text, 'type': q.question_type})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@admin_required
@require_http_methods(['POST'])
def feedback_question_delete(request, pk):
    q = get_object_or_404(FeedbackQuestion, pk=pk)
    q.delete()
    return JsonResponse({'success': True})


@admin_required
@require_http_methods(['POST'])
def feedback_toggle(request, session_pk):
    sess = get_object_or_404(ScheduleSession, pk=session_pk)
    try:
        body = json.loads(request.body)
        field = body.get('field', 'feedback_manual_open')
        if field == 'feedback_manual_open':
            sess.feedback_manual_open = not sess.feedback_manual_open
            sess.save(update_fields=['feedback_manual_open'])
        elif field == 'feedback_enabled':
            sess.feedback_enabled = not sess.feedback_enabled
            sess.save(update_fields=['feedback_enabled'])
        return JsonResponse({
            'success': True,
            'feedback_manual_open': sess.feedback_manual_open,
            'feedback_enabled': sess.feedback_enabled,
            'feedback_open': sess.feedback_open
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


# ── Feedback Analytics ───────────────────────────────────────────────────────

@admin_required
def feedback_analytics(request, session_pk):
    from django.db.models import Avg
    sess      = get_object_or_404(ScheduleSession, pk=session_pk)
    responses = FeedbackResponse.objects.filter(session=sess).prefetch_related('answers__question').select_related('user')
    total     = responses.count()

    try:
        questions = sess.feedback_form.questions.all()
    except FeedbackForm.DoesNotExist:
        questions = []

    q_stats = []
    for q in questions:
        stat = {'q': q}
        if q.question_type == 'rating':
            agg = FeedbackAnswer.objects.filter(question=q).aggregate(avg=Avg('rating_value'))
            stat['avg'] = round(agg['avg'], 1) if agg['avg'] else None
            dist = {}
            for v in range(1, 6):
                dist[v] = FeedbackAnswer.objects.filter(question=q, rating_value=v).count()
            stat['dist'] = dist
        elif q.question_type == 'boolean':
            yes = FeedbackAnswer.objects.filter(question=q, boolean_value=True).count()
            stat['yes'] = yes
            stat['no']  = total - yes
            stat['yes_pct'] = round(yes / total * 100, 1) if total else 0
        q_stats.append(stat)

    return render(request, 'panel/schedule_analytics.html', {
        'session':   sess,
        'responses': responses,
        'total':     total,
        'q_stats':   q_stats,
    })


# ── Helper ───────────────────────────────────────────────────────────────────

def _ensure_feedback_form(sess):
    form, created = FeedbackForm.objects.get_or_create(
        session=sess,
        defaults={'title': f'Feedback: {sess.title}'}
    )
    if created:
        defaults = [
            ('How would you rate this session overall?',       'rating',  True,  1),
            ('How relevant was the content to your interests?','rating',  True,  2),
            ('How effective was the speaker/presenter?',       'rating',  True,  3),
            ('Would you recommend this session to others?',    'boolean', True,  4),
            ('Any comments or suggestions?',                   'text',    False, 5),
        ]
        for text, qtype, req, order in defaults:
            FeedbackQuestion.objects.create(
                form=form, question_text=text,
                question_type=qtype, is_required=req, display_order=order
            )
    return form
