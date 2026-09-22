import uuid
from datetime import datetime, date, time as dtime
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q, Avg, Count
from django.shortcuts import get_object_or_404

from apps.accounts.permissions_helper import api_module_required
from apps.checkins.meal_utils import sync_meal_window
from .models import (
    ScheduleSession, AcceptedPaper, ScheduleSubSession,
    SessionBookmark, PaperBookmark, FeedbackForm, FeedbackQuestion,
    FeedbackResponse, FeedbackAnswer, SESSION_TYPE
)
from .utils import (
    IST, _parse_panel_dt, _validate_document,
    _ensure_feedback_form, _combine_iso
)


def _serialize_session(s, bookmarked_ids=None, bookmarked_paper_ids=None):
    bookmarked_ids = bookmarked_ids or set()
    bookmarked_paper_ids = bookmarked_paper_ids or set()
    subs = []
    try:
        for sub in s.sub_sessions.all():
            subs.append({
                'id': str(sub.id),
                'title': sub.title,
                'speaker_name': sub.speaker_name or '',
                'start_datetime': _combine_iso(s.date, sub.start_time) if sub.start_time else None,
                'end_datetime': _combine_iso(s.date, sub.end_time) if sub.end_time else None,
            })
    except Exception:
        pass

    papers = []
    try:
        for p in s.papers.filter(is_published=True):
            papers.append({
                'id': str(p.id),
                'paper_id': p.paper_id,
                'paper_type': p.paper_type,
                'title': p.title,
                'authors': p.authors,
                'abstract': p.abstract or '',
                'track': p.track or '',
                'slot_start': str(p.slot_start) if p.slot_start else None,
                'slot_end': str(p.slot_end) if p.slot_end else None,
                'start_datetime': _combine_iso(s.date, p.slot_start) if p.slot_start else None,
                'end_datetime': _combine_iso(s.date, p.slot_end) if p.slot_end else None,
                'is_bookmarked': str(p.id) in bookmarked_paper_ids,
            })
    except Exception:
        pass

    feedback_enabled = bool(getattr(s, 'feedback_enabled', False))
    feedback_open = False
    try:
        form = s.feedback_forms.filter(is_active=True).first()
        if form and feedback_enabled:
            feedback_open = True
    except Exception:
        pass

    return {
        'id': str(s.id),
        'day': s.day,
        'title': s.title,
        'session_type': s.session_type,
        'date': str(s.date),
        'start_time': str(s.start_time) if s.start_time else None,
        'end_time': str(s.end_time) if s.end_time else None,
        'start_datetime': _combine_iso(s.date, s.start_time),
        'end_datetime': _combine_iso(s.date, s.end_time),
        'room': s.room or '',
        'chair': s.chair or '',
        'description': s.description or '',
        'display_order': s.display_order,
        'is_featured': bool(getattr(s, 'is_featured', False)),
        'is_published': bool(getattr(s, 'is_published', True)),
        'status': getattr(s, 'status', 'published') or 'published',
        'is_meal': getattr(s, 'is_meal', False),
        'meal_category': getattr(s, 'meal_category', 'Lunch') or 'Lunch',
        'is_parallel': getattr(s, 'is_parallel', False),
        'is_bookmarked': str(s.id) in bookmarked_ids,
        'sub_sessions': subs,
        'papers': papers,
        'feedback_enabled': feedback_enabled,
        'feedback_open': feedback_open,
        'feedback_auto_open': bool(getattr(s, 'feedback_auto_open', False)),
    }


# ── Public Endpoints ──

@api_view(['GET'])
@permission_classes([AllowAny])
def session_list(request):
    qs = ScheduleSession.objects.all().prefetch_related('sub_sessions', 'papers', 'feedback_forms')

    if hasattr(ScheduleSession, 'is_published'):
        qs = qs.filter(is_published=True)

    day = request.GET.get('day')
    if day not in (None, '', 'all'):
        try:
            qs = qs.filter(day=int(day))
        except (TypeError, ValueError):
            pass

    bookmarked_ids = set()
    user = getattr(request, 'user', None)
    if user is not None and getattr(user, 'is_authenticated', False):
        bookmarked_ids = set(str(x) for x in SessionBookmark.objects.filter(user=user).values_list('session_id', flat=True))
        bookmarked_paper_ids = set(str(x) for x in PaperBookmark.objects.filter(user=user).values_list('paper_id', flat=True))

    sessions = [_serialize_session(s, bookmarked_ids, bookmarked_paper_ids) for s in qs.order_by('date', 'start_time', 'display_order')]

    by_day = {}
    for s in sessions:
        by_day.setdefault(s['date'], []).append(s)
    for day_list in by_day.values():
        for i, a in enumerate(day_list):
            for b in day_list[i + 1:]:
                if a['start_time'] and a['end_time'] and b['start_time'] and b['end_time']:
                    if a['start_time'] < b['end_time'] and b['start_time'] < a['end_time']:
                        a['is_parallel'] = True
                        b['is_parallel'] = True

    return Response({'sessions': sessions, 'count': len(sessions)})


@api_view(['GET'])
@permission_classes([AllowAny])
def session_detail(request, pk):
    s = get_object_or_404(ScheduleSession, pk=pk)
    bookmarked_ids = set()
    user = getattr(request, 'user', None)
    if user is not None and getattr(user, 'is_authenticated', False):
        if SessionBookmark.objects.filter(user=user, session=s).exists():
            bookmarked_ids.add(str(s.id))
    return Response(_serialize_session(s, bookmarked_ids))


@api_view(['GET'])
@permission_classes([AllowAny])
def public_accepted_papers(request):
    paper_type = request.GET.get('type', 'paper')
    search = request.GET.get('search', '').strip()
    qs = AcceptedPaper.objects.filter(is_published=True)
    if paper_type in ('paper', 'poster'):
        qs = qs.filter(paper_type=paper_type)
    if search:
        qs = qs.filter(
            Q(title__icontains=search) |
            Q(authors__icontains=search) |
            Q(paper_id__icontains=search) |
            Q(track__icontains=search)
        )
    results = []
    for p in qs.select_related('session'):
        session_info = None
        if p.session:
            session_info = {
                'id': str(p.session.id),
                'title': p.session.title,
                'room': p.session.room or 'TBD',
                'date': str(p.session.date),
                'start_time': str(p.session.start_time),
                'end_time': str(p.session.end_time),
            }
        results.append({
            'id': str(p.id),
            'paper_id': p.paper_id,
            'paper_type': p.paper_type,
            'title': p.title,
            'authors': p.authors,
            'abstract': p.abstract,
            'track': p.track,
            'slot_start': str(p.slot_start) if p.slot_start else None,
            'slot_end': str(p.slot_end) if p.slot_end else None,
            'presentation_time': (
                f"{p.slot_start.strftime('%I:%M %p') if p.slot_start else ''}"
                f" @ {p.session.room if p.session else 'TBD'}"
            ).strip(' @'),
            'session': session_info,
            'pdf_url': p.pdf_url or (p.document.url if p.document else None),
            'is_published': p.is_published,
        })
    return Response({'results': results})


# ── Authenticated User Endpoints ──

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_bookmarks(request):
    out = []
    bookmarked_paper_ids = set(str(x) for x in PaperBookmark.objects.filter(user=request.user).values_list('paper_id', flat=True))
    for b in SessionBookmark.objects.filter(user=request.user).select_related('session'):
        out.append({
            'type': 'session',
            'reminder_minutes': getattr(b, 'reminder_minutes', 5),
            'session': _serialize_session(b.session, {str(b.session_id)}, bookmarked_paper_ids),
        })
    for pb in PaperBookmark.objects.filter(user=request.user).select_related('paper__session'):
        p = pb.paper
        out.append({
            'type': 'paper',
            'paper': {
                'id': str(p.id),
                'paper_id': p.paper_id,
                'paper_type': p.paper_type,
                'title': p.title,
                'authors': p.authors,
                'abstract': p.abstract or '',
                'track': p.track or '',
                'session_title': p.session.title if p.session else '',
                'session_room': p.session.room if p.session else '',
                'slot_start': str(p.slot_start) if p.slot_start else None,
                'slot_end': str(p.slot_end) if p.slot_end else None,
                'is_bookmarked': True,
                'reminder_minutes': getattr(pb, 'reminder_minutes', 5),
            }
        })
    return Response({'bookmarks': out})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_bookmark(request, pk):
    s = get_object_or_404(ScheduleSession, pk=pk)
    existing = SessionBookmark.objects.filter(user=request.user, session=s).first()
    if existing:
        existing.delete()
        return Response({'success': True, 'bookmarked': False})
    
    minutes = request.data.get('reminder_minutes', 5)
    SessionBookmark.objects.create(user=request.user, session=s, reminder_minutes=int(minutes))
    return Response({'success': True, 'bookmarked': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_reminder(request, pk):
    return Response({'success': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def feedback_form(request, pk):
    sess = get_object_or_404(ScheduleSession, pk=pk)
    if not sess.feedback_enabled:
        return Response({'error': 'Feedback is not enabled for this session.'}, status=status.HTTP_403_FORBIDDEN)

    form = sess.feedback_forms.filter(is_active=True).first()
    if not form:
        form = _ensure_feedback_form(sess)

    already_done = FeedbackResponse.objects.filter(session=sess, user=request.user).exists()
    questions = []
    for q in form.questions.all().order_by('order'):
        questions.append({
            'id': str(q.id),
            'question_text': q.question_text,
            'question_type': q.question_type,
            'options': q.options,
            'is_required': q.is_required,
        })

    return Response({
        'form': {
            'id': str(form.id),
            'title': form.title,
            'description': form.description or '',
            'questions': questions,
        },
        'already_submitted': already_done,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_feedback(request, pk):
    sess = get_object_or_404(ScheduleSession, pk=pk)
    if not sess.feedback_enabled:
        return Response({'success': False, 'error': 'Feedback is not enabled for this session.'}, status=status.HTTP_400_BAD_REQUEST)

    if FeedbackResponse.objects.filter(session=sess, user=request.user).exists():
        return Response({'success': False, 'error': 'You have already submitted feedback for this session.'}, status=status.HTTP_400_BAD_REQUEST)

    form = sess.feedback_forms.filter(is_active=True).first() or _ensure_feedback_form(sess)
    answers_data = request.data.get('answers', [])
    if not answers_data:
        return Response({'success': False, 'error': 'No answers provided.'}, status=status.HTTP_400_BAD_REQUEST)

    resp = FeedbackResponse.objects.create(
        form=form,
        session=sess,
        user=request.user,
        answers={},
    )

    stored_answers = {}
    for ans in answers_data:
        qid = ans.get('question_id')
        if not qid:
            continue
        question = FeedbackQuestion.objects.filter(id=qid, form=form).first()
        if not question:
            continue

        rating_val = ans.get('rating_value')
        bool_val = ans.get('boolean_value')
        text_val = ans.get('text_value', '')

        answer_text = ''
        if question.question_type == 'rating' and rating_val is not None:
            answer_text = str(rating_val)
        elif question.question_type == 'boolean' and bool_val is not None:
            answer_text = 'Yes' if bool_val else 'No'
        else:
            answer_text = str(text_val or '')

        FeedbackAnswer.objects.create(
            response=resp,
            question=question,
            answer_text=answer_text,
            rating_value=rating_val if question.question_type == 'rating' else None,
        )
        stored_answers[str(qid)] = answer_text

    resp.answers = stored_answers
    resp.save(update_fields=['answers'])

    return Response({'success': True, 'message': 'Feedback submitted successfully! Thank you.'})


# ── Staff / Admin Endpoints (Module-Guarded) ──

@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated])
@api_module_required('papers')
@parser_classes([MultiPartParser, FormParser, JSONParser])
def mobile_admin_papers(request):
    if request.method == 'GET':
        qs = AcceptedPaper.objects.all().select_related('session')
        results = []
        for p in qs:
            results.append({
                'id': str(p.id),
                'paper_id': p.paper_id,
                'paper_type': p.paper_type,
                'title': p.title,
                'authors': p.authors,
                'abstract': p.abstract,
                'track': p.track,
                'slot_start': str(p.slot_start) if p.slot_start else None,
                'slot_end': str(p.slot_end) if p.slot_end else None,
                'session_id': str(p.session.id) if p.session else None,
                'session_title': p.session.title if p.session else None,
                'pdf_url': p.pdf_url or (p.document.url if p.document else None),
                'is_published': p.is_published,
            })
        return Response({'results': results})

    if request.method == 'POST':
        doc = request.FILES.get('document')
        if doc:
            doc_err = _validate_document(doc)
            if doc_err:
                return Response({'success': False, 'error': doc_err}, status=status.HTTP_400_BAD_REQUEST)

        session = None
        session_id = request.data.get('session_id')
        if session_id:
            session = ScheduleSession.objects.filter(pk=session_id).first()
        paper = AcceptedPaper.objects.create(
            paper_id=request.data.get('paper_id'),
            paper_type=request.data.get('paper_type', 'paper'),
            title=request.data.get('title'),
            authors=request.data.get('authors'),
            abstract=request.data.get('abstract', ''),
            track=request.data.get('track', ''),
            session=session,
            slot_start=request.data.get('slot_start') or None,
            slot_end=request.data.get('slot_end') or None,
            document=doc or None,
            is_published=True,
        )
        return Response({'success': True, 'id': str(paper.id)}, status=status.HTTP_201_CREATED)

    pid = request.GET.get('id') or request.data.get('id')
    if not pid:
        return Response({'error': 'Paper ID required'}, status=status.HTTP_400_BAD_REQUEST)
    get_object_or_404(AcceptedPaper, pk=pid).delete()
    return Response({'success': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@api_module_required('schedule')
def admin_session_list(request):
    return session_list(request)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@api_module_required('schedule')
def admin_session_create(request):
    data = request.data
    try:
        start_dt = _parse_panel_dt(data.get('start_datetime'))
        end_dt = _parse_panel_dt(data.get('end_datetime'))
        if not start_dt or not end_dt:
            return Response({'error': 'Valid start_datetime and end_datetime are required.'}, status=status.HTTP_400_BAD_REQUEST)

        sess = ScheduleSession.objects.create(
            day=int(data.get('day', 1)),
            title=str(data.get('title', '')).strip(),
            session_type=data.get('session_type', 'technical'),
            start_datetime=start_dt,
            end_datetime=end_dt,
            room=str(data.get('room', '')).strip(),
            description=str(data.get('description', '')).strip(),
            display_order=int(data.get('display_order') or 0),
            is_featured=bool(data.get('is_featured', False)),
            is_parallel=bool(data.get('is_parallel', False)),
            is_published=bool(data.get('is_published', True)),
            is_meal=bool(data.get('is_meal', False)),
            meal_category=str(data.get('meal_category', 'Lunch')).strip(),
            feedback_enabled=bool(data.get('feedback_enabled', True)),
            feedback_auto_open=bool(data.get('feedback_auto_open', False)),
        )
        if sess.feedback_enabled:
            _ensure_feedback_form(sess)
        try:
            sync_meal_window()
        except Exception:
            pass
        return Response(_serialize_session(sess), status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
@api_module_required('schedule')
def admin_session_update(request, pk):
    sess = get_object_or_404(ScheduleSession, pk=pk)
    data = request.data
    try:
        if 'day' in data:
            sess.day = int(data['day'])
        if 'title' in data:
            sess.title = str(data['title']).strip()
        if 'session_type' in data:
            sess.session_type = data['session_type']
        if 'start_datetime' in data and data['start_datetime']:
            sess.start_datetime = _parse_panel_dt(data['start_datetime'])
        if 'end_datetime' in data and data['end_datetime']:
            sess.end_datetime = _parse_panel_dt(data['end_datetime'])
        if 'room' in data:
            sess.room = str(data['room']).strip()
        if 'description' in data:
            sess.description = str(data['description']).strip()
        if 'display_order' in data:
            sess.display_order = int(data['display_order'] or 0)
        if 'is_featured' in data:
            sess.is_featured = bool(data['is_featured'])
        if 'is_parallel' in data:
            sess.is_parallel = bool(data['is_parallel'])
        if 'is_published' in data:
            sess.is_published = bool(data['is_published'])
        if 'is_meal' in data:
            sess.is_meal = bool(data['is_meal'])
        if 'meal_category' in data:
            sess.meal_category = str(data['meal_category']).strip()
        if 'feedback_enabled' in data:
            sess.feedback_enabled = bool(data['feedback_enabled'])
        if 'feedback_auto_open' in data:
            sess.feedback_auto_open = bool(data['feedback_auto_open'])

        sess.save()
        if sess.feedback_enabled:
            _ensure_feedback_form(sess)
        try:
            sync_meal_window()
        except Exception:
            pass
        return Response(_serialize_session(sess))
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE', 'POST'])
@permission_classes([IsAuthenticated])
@api_module_required('schedule')
def admin_session_delete(request, pk):
    sess = get_object_or_404(ScheduleSession, pk=pk)
    sess.delete()
    return Response({'success': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@api_module_required('schedule')
def admin_subsession_create(request, session_pk):
    sess = get_object_or_404(ScheduleSession, pk=session_pk)
    data = request.data
    try:
        sub = ScheduleSubSession.objects.create(
            session=sess,
            title=str(data.get('title', '')).strip(),
            speaker_name=str(data.get('speaker_name', '')).strip(),
            start_time=_parse_panel_dt(data.get('start_datetime')).time() if data.get('start_datetime') else None,
            end_time=_parse_panel_dt(data.get('end_datetime')).time() if data.get('end_datetime') else None,
        )
        return Response({'success': True, 'id': str(sub.id), 'title': sub.title}, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE', 'POST'])
@permission_classes([IsAuthenticated])
@api_module_required('schedule')
def admin_subsession_delete(request, pk):
    sub = get_object_or_404(ScheduleSubSession, pk=pk)
    sub.delete()
    return Response({'success': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@api_module_required('schedule')
def admin_toggle_feedback(request, pk):
    sess = get_object_or_404(ScheduleSession, pk=pk)
    form = sess.feedback_forms.filter(is_active=True).first()
    if not form:
        form = _ensure_feedback_form(sess)
        form.is_active = True
        form.save(update_fields=['is_active'])
    else:
        form.is_active = not form.is_active
        form.save(update_fields=['is_active'])

    return Response({
        'success': True,
        'feedback_open': form.is_active,
        'feedback_manual_open': form.is_active,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@api_module_required('schedule')
def admin_feedback_analytics(request, pk):
    sess = get_object_or_404(ScheduleSession, pk=pk)
    responses = FeedbackResponse.objects.filter(session=sess).prefetch_related('answers_list__question').select_related('user')
    total = responses.count()

    form = sess.feedback_forms.filter(is_active=True).first() or _ensure_feedback_form(sess)
    questions = form.questions.all().order_by('order')

    q_stats = []
    for q in questions:
        stat = {'text': q.question_text, 'type': q.question_type}
        if q.question_type == 'rating':
            agg = FeedbackAnswer.objects.filter(question=q, response__session=sess).aggregate(avg=Avg('rating_value'))
            stat['avg_rating'] = round(agg['avg'], 1) if agg['avg'] else None
        elif q.question_type == 'boolean':
            yes_count = FeedbackAnswer.objects.filter(question=q, response__session=sess, answer_text__iexact='Yes').count()
            stat['yes_count'] = yes_count
            stat['no_count'] = max(0, total - yes_count)
            stat['yes_pct'] = round((yes_count / total * 100), 1) if total > 0 else 0
        q_stats.append(stat)

    resp_list = []
    for r in responses:
        answers = []
        for a in r.answers_list.all():
            answers.append({
                'question_text': a.question.question_text,
                'question_type': a.question.question_type,
                'rating_value': a.rating_value,
                'boolean_value': a.answer_text == 'Yes',
                'text_value': a.answer_text or '',
            })
        resp_list.append({
            'id': str(r.id),
            'user_name': r.user.get_full_name() if r.user else 'Anonymous',
            'user_email': r.user.email if r.user else '',
            'answers': answers,
        })

    return Response({
        'total_responses': total,
        'question_stats': q_stats,
        'responses': resp_list,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_paper_bookmark(request, pk):
    paper = get_object_or_404(AcceptedPaper, pk=pk)
    existing = PaperBookmark.objects.filter(user=request.user, paper=paper).first()
    if existing:
        existing.delete()
        return Response({'success': True, 'bookmarked': False})
        
    minutes = request.data.get('reminder_minutes', 5)
    PaperBookmark.objects.create(user=request.user, paper=paper, reminder_minutes=int(minutes))
    return Response({'success': True, 'bookmarked': True})
