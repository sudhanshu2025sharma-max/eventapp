from datetime import datetime, date, time
import json
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.utils import timezone

from apps.accounts.admin_views import admin_required
from apps.accounts.permissions_helper import module_required
from apps.checkins.meal_utils import sync_meal_window
from .models import (
    ScheduleSession, ScheduleSubSession, AcceptedPaper, SESSION_TYPE,
    FeedbackForm, FeedbackQuestion, FeedbackResponse, FeedbackAnswer
)
from .utils import (
    IST, _parse_panel_dt, _validate_document, _ensure_feedback_form
)


@admin_required
@module_required('schedule')
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
        'days':       [(1,'Day 1 — Sep 18'),(2,'Day 2 — Sep 19'),(3,'Day 3 — Sep 20')],
    })


@admin_required
@module_required('schedule')
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
                is_meal=request.POST.get('is_meal') == 'on',
                meal_category=request.POST.get('meal_category', 'Lunch').strip(),
                feedback_enabled=request.POST.get('feedback_enabled') == 'on',
                feedback_auto_open=request.POST.get('feedback_auto_open') == 'on',
                display_order=int(request.POST.get('display_order') or 0),
            )
            if sess.feedback_enabled:
                _ensure_feedback_form(sess)
            
            try:
                sync_meal_window()
            except Exception:
                pass

            messages.success(request, f'Session "{sess.title}" created.')
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
@module_required('schedule')
@require_http_methods(['GET', 'POST'])
def session_edit(request, pk):
    sess = get_object_or_404(ScheduleSession, pk=pk)

    if request.method == 'POST':
        try:
            sess.day            = int(request.POST['day'])
            sess.title          = request.POST['title'].strip()
            sess.session_type   = request.POST.get('session_type', sess.session_type)
            if request.POST.get('start_datetime'):
                sess.start_datetime = _parse_panel_dt(request.POST['start_datetime'])
            if request.POST.get('end_datetime'):
                sess.end_datetime   = _parse_panel_dt(request.POST['end_datetime'])
            sess.room           = request.POST.get('room', '').strip()
            sess.description    = request.POST.get('description', '').strip()
            sess.is_featured    = request.POST.get('is_featured') == 'on'
            sess.is_parallel    = request.POST.get('is_parallel') == 'on'
            sess.is_published   = request.POST.get('is_published') == 'on'
            sess.is_meal        = request.POST.get('is_meal') == 'on'
            sess.meal_category  = request.POST.get('meal_category', 'Lunch').strip()
            sess.feedback_enabled   = request.POST.get('feedback_enabled') == 'on'
            sess.feedback_auto_open = request.POST.get('feedback_auto_open') == 'on'
            sess.display_order  = int(request.POST.get('display_order') or 0)
            sess.save()

            if sess.feedback_enabled:
                _ensure_feedback_form(sess)

            try:
                sync_meal_window()
            except Exception:
                pass

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
        'papers':        sess.papers.all().order_by('slot_start', 'slot_order'),
    })


@admin_required
@module_required('schedule')
@require_http_methods(['POST'])
def session_delete(request, pk):
    sess = get_object_or_404(ScheduleSession, pk=pk)
    title = sess.title
    sess.delete()
    messages.success(request, f'Session "{title}" deleted.')
    return redirect('schedule_panel')


@admin_required
@module_required('schedule')
@require_http_methods(['POST'])
def subsession_add(request, session_pk):
    sess = get_object_or_404(ScheduleSession, pk=session_pk)
    try:
        body = json.loads(request.body)
        sub  = ScheduleSubSession.objects.create(
            session=sess,
            title=body['title'].strip(),
            speaker_name=body.get('speaker_name', '').strip(),
            start_time=_parse_panel_dt(body.get('start_datetime')).time() if body.get('start_datetime') else None,
            end_time=_parse_panel_dt(body.get('end_datetime')).time() if body.get('end_datetime') else None,
        )
        return JsonResponse({'success': True, 'id': str(sub.id), 'title': sub.title})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@admin_required
@module_required('schedule')
@require_http_methods(['POST'])
def subsession_delete(request, pk):
    sub = get_object_or_404(ScheduleSubSession, pk=pk)
    sub.delete()
    return JsonResponse({'success': True})


@admin_required
@module_required('schedule')
def feedback_manage(request, session_pk):
    sess = get_object_or_404(ScheduleSession, pk=session_pk)
    form, _ = FeedbackForm.objects.get_or_create(session=sess, defaults={'title': f'Feedback: {sess.title}'})
    questions = form.questions.all().order_by('order')
    response_count = FeedbackResponse.objects.filter(session=sess).count()

    return render(request, 'panel/schedule_feedback.html', {
        'session':        sess,
        'form':           form,
        'questions':      questions,
        'response_count': response_count,
    })


@admin_required
@module_required('schedule')
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
            order=form.questions.count() + 1,
        )
        return JsonResponse({'success': True, 'id': str(q.id), 'text': q.question_text, 'type': q.question_type})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@admin_required
@module_required('schedule')
@require_http_methods(['POST'])
def feedback_question_delete(request, pk):
    q = get_object_or_404(FeedbackQuestion, pk=pk)
    q.delete()
    return JsonResponse({'success': True})


@admin_required
@module_required('schedule')
@require_http_methods(['POST'])
def feedback_toggle(request, session_pk):
    sess = get_object_or_404(ScheduleSession, pk=session_pk)
    try:
        body = json.loads(request.body)
        field = body.get('field', 'feedback_auto_open')
        if field == 'feedback_auto_open':
            sess.feedback_auto_open = not sess.feedback_auto_open
            sess.save(update_fields=['feedback_auto_open'])
        elif field == 'feedback_enabled':
            sess.feedback_enabled = not sess.feedback_enabled
            sess.save(update_fields=['feedback_enabled'])
        return JsonResponse({
            'success': True,
            'feedback_auto_open': sess.feedback_auto_open,
            'feedback_enabled': sess.feedback_enabled,
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@admin_required
@module_required('schedule')
def feedback_analytics(request, session_pk):
    from django.db.models import Avg
    sess = get_object_or_404(ScheduleSession, pk=session_pk)
    responses = FeedbackResponse.objects.filter(session=sess).prefetch_related('answers_list__question').select_related('user')
    total = responses.count()

    form = sess.feedback_forms.filter(is_active=True).first()
    questions = form.questions.all().order_by('order') if form else []

    q_stats = []
    for q in questions:
        stat = {'q': q}
        if q.question_type == 'rating':
            agg = FeedbackAnswer.objects.filter(question=q, response__session=sess).aggregate(avg=Avg('rating_value'))
            stat['avg'] = round(agg['avg'], 1) if agg['avg'] else None
            dist = {}
            for v in range(1, 6):
                dist[v] = FeedbackAnswer.objects.filter(question=q, rating_value=v, response__session=sess).count()
            stat['dist'] = dist
        elif q.question_type == 'choice' or q.question_type == 'boolean':
            stat['answers'] = FeedbackAnswer.objects.filter(question=q, response__session=sess).values_list('answer_text', flat=True)
        q_stats.append(stat)

    return render(request, 'panel/schedule_analytics.html', {
        'session':   sess,
        'responses': responses,
        'total':     total,
        'q_stats':   q_stats,
    })


@admin_required
@module_required('papers')
def accepted_papers_panel(request):
    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'create':
            doc = request.FILES.get('document')
            if doc:
                doc_err = _validate_document(doc)
                if doc_err:
                    messages.error(request, doc_err)
                    return redirect('accepted_papers_panel')

            session_id = request.POST.get('session_id') or None
            session_obj = ScheduleSession.objects.filter(pk=session_id).first() if session_id else None
            
            slot_s = request.POST.get('slot_start') or None
            slot_e = request.POST.get('slot_end') or None

            AcceptedPaper.objects.create(
                paper_id=request.POST.get('paper_id', '').strip(),
                title=request.POST.get('title', '').strip(),
                authors=request.POST.get('authors', '').strip(),
                abstract=request.POST.get('abstract', '').strip(),
                document=doc,
                track=request.POST.get('track', '').strip(),
                paper_type=request.POST.get('paper_type', 'paper'),
                session=session_obj,
                slot_start=slot_s,
                slot_end=slot_e,
                pdf_url=request.POST.get('pdf_url', '').strip(),
            )
            messages.success(request, "Paper / Poster added successfully!")
            return redirect('accepted_papers_panel')
        elif action == 'delete':
            pk = request.POST.get('pk')
            AcceptedPaper.objects.filter(pk=pk).delete()
            messages.success(request, "Item deleted successfully!")
            return redirect('accepted_papers_panel')

    papers = AcceptedPaper.objects.select_related('session').all()
    sessions = ScheduleSession.objects.all().order_by('date', 'start_time')
    return render(request, 'panel/accepted_papers.html', {
        'papers': papers,
        'sessions': sessions,
        'paper_count': papers.filter(paper_type='paper').count(),
        'poster_count': papers.filter(paper_type='poster').count(),
    })

@admin_required
@module_required('schedule')
@require_http_methods(['POST'])
def session_paper_add(request, session_pk):
    sess = get_object_or_404(ScheduleSession, pk=session_pk)
    try:
        body = json.loads(request.body)
        slot_s = _parse_panel_dt(body.get('slot_start')).time() if body.get('slot_start') else None
        slot_e = _parse_panel_dt(body.get('slot_end')).time() if body.get('slot_end') else None

        paper = AcceptedPaper.objects.create(
            session=sess,
            paper_id=body.get('paper_id', '').strip(),
            title=body['title'].strip(),
            authors=body.get('authors', '').strip(),
            abstract=body.get('abstract', '').strip(),
            track=body.get('track', '').strip(),
            paper_type=body.get('paper_type', 'paper'),
            slot_start=slot_s,
            slot_end=slot_e,
            is_published=True,
        )
        return JsonResponse({'success': True, 'id': str(paper.id), 'title': paper.title})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@admin_required
@module_required('schedule')
@require_http_methods(['POST'])
def session_paper_delete(request, pk):
    paper = get_object_or_404(AcceptedPaper, pk=pk)
    paper.delete()
    return JsonResponse({'success': True})
