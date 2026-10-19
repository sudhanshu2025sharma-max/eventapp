from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.db.models import Count, Q
from django.db import transaction
from django.core.paginator import Paginator
from django.core.exceptions import ValidationError
from .quiz import apply_feed_extras, apply_feed_content
from .models import FeedPost, FeedComment, FeedReaction
from apps.schedule.models import ScheduleSession
from apps.accounts.permissions_helper import module_required


def _quiz_form_context(request, post=None):
    if request.method == 'POST':
        return {'type': request.POST.get('quiz_type', ''),
                'question': request.POST.get('quiz_question', ''),
                'options': request.POST.getlist('quiz_option'),
                'correct': request.POST.get('quiz_correct_option', '')}
    return {'type': post.quiz_type if post else '',
            'question': post.quiz_question if post else '',
            'options': post.quiz_options if post else [],
            'correct': post.quiz_correct_option if post else None}


@login_required
@module_required('feed')
def feed_panel(request):
    tab = request.GET.get('tab', 'published')

    posts = FeedPost.objects.select_related('author', 'session').annotate(
        reaction_count=Count('reactions', distinct=True),
        comment_count=Count('comments', distinct=True),
    )

    now = timezone.now()
    if tab == 'published':
        posts = posts.filter(published_at__isnull=False, published_at__lte=now)
    elif tab == 'scheduled':
        posts = posts.filter(scheduled_at__isnull=False, published_at__isnull=True)
    elif tab == 'draft':
        posts = posts.filter(published_at__isnull=True, scheduled_at__isnull=True)

    posts = posts.order_by('-pinned', '-created_at')

    stats = {
        'total':     FeedPost.objects.count(),
        'published': FeedPost.objects.filter(published_at__isnull=False, published_at__lte=now).count(),
        'scheduled': FeedPost.objects.filter(scheduled_at__isnull=False, published_at__isnull=True).count(),
        'draft':     FeedPost.objects.filter(published_at__isnull=True, scheduled_at__isnull=True).count(),
    }

    return render(request, 'panel/feed_list.html', {
        'posts': posts,
        'tab': tab,
        'stats': stats,
    })


@login_required
@module_required('feed')
def feed_quiz_stats(request, pk=None):
    quizzes = FeedPost.objects.filter(post_type='quiz').annotate(
        response_count=Count('quiz_responses')).order_by('-created_at')
    if pk is None:
        return render(request, 'panel/feed_quiz_stats.html', {
            'quiz_page': Paginator(quizzes, 25).get_page(request.GET.get('page')),
            'quiz_count': quizzes.count(),
            'response_count': FeedPost.objects.filter(post_type='quiz').aggregate(
                total=Count('quiz_responses'))['total'],
        })

    post = get_object_or_404(quizzes, pk=pk)
    counts = dict(post.quiz_responses.values('selected_option').annotate(
        total=Count('id')).values_list('selected_option', 'total'))
    options = [{
        'index': i, 'label': label, 'count': counts.get(i, 0),
        'percent': round(counts.get(i, 0) * 100 / post.response_count, 1) if post.response_count else 0,
        'correct': post.quiz_correct_option == i,
        'selected': request.GET.get('option') == str(i),
    } for i, label in enumerate(post.quiz_options)]
    answers = post.quiz_responses.select_related('user').order_by('-created_at', '-pk')
    search = request.GET.get('q', '').strip()[:200]
    selected_option = request.GET.get('option', '')
    if search:
        answers = answers.filter(
            Q(user__first_name__icontains=search) | Q(user__last_name__icontains=search)
            | Q(user__email__icontains=search) | Q(user__registration_id__icontains=search))
    if selected_option:
        if selected_option.isdigit() and int(selected_option) < len(post.quiz_options):
            answers = answers.filter(selected_option=int(selected_option))
        else:
            answers = answers.none()
    page = Paginator(answers, 50).get_page(request.GET.get('page'))
    rows = [{
        'user': answer.user,
        'option': post.quiz_options[answer.selected_option],
        'created_at': answer.created_at,
        'correct': answer.selected_option == post.quiz_correct_option,
    } for answer in page]
    return render(request, 'panel/feed_quiz_stats.html', {
        'post': post, 'options': options, 'rows': rows, 'response_page': page,
        'has_correct_answer': post.quiz_correct_option is not None,
        'correct_count': counts.get(post.quiz_correct_option, 0),
        'search': search, 'selected_option': selected_option,
    })


@login_required
@module_required('feed')
def feed_create(request):
    sessions = ScheduleSession.objects.filter(is_published=True).order_by('day', 'date', 'start_time')
    if request.method == 'POST':
        post = _save_post(request, FeedPost())
        if post:
            # trigger immediate push if published now (direct call — no Celery on VM)
            if post.send_push and not post.push_sent and post.is_live:
                try:
                    from apps.posts.tasks import send_post_push
                    send_post_push(str(post.id))  # call directly, not .delay()
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning(f'Feed push failed: {e}')
            messages.success(request, 'Post created.')
            return redirect(f'/panel/feed/?tab={"scheduled" if post.scheduled_at else "published"}')
    return render(request, 'panel/feed_form.html', {
        'mode': 'create',
        'quiz_form': _quiz_form_context(request),
        'sessions': sessions,
        'post_types': FeedPost.POST_TYPES,
    })


@login_required
@module_required('feed')
@transaction.atomic
def feed_edit(request, pk):
    post = get_object_or_404(FeedPost.objects.select_for_update(), pk=pk)
    sessions = ScheduleSession.objects.filter(is_published=True).order_by('day', 'date', 'start_time')
    if request.method == 'POST':
        updated = _save_post(request, post)
        if updated:
            messages.success(request, 'Post updated.')
            return redirect('/panel/feed/')
    return render(request, 'panel/feed_form.html', {
        'mode': 'edit',
        'quiz_form': _quiz_form_context(request, post),
        'quiz_results': [{'option': option, 'count': post.quiz_responses.filter(selected_option=i).count()}
                         for i, option in enumerate(post.quiz_options)],
        'post': post,
        'sessions': sessions,
        'post_types': FeedPost.POST_TYPES,
    })


@login_required
@module_required('feed')
def feed_delete(request, pk):
    post = get_object_or_404(FeedPost, pk=pk)
    if request.method == 'POST':
        post.delete()
        messages.success(request, 'Post deleted.')
    return redirect('/panel/feed/')


@login_required
@module_required('feed')
def feed_pin_toggle(request, pk):
    post = get_object_or_404(FeedPost, pk=pk)
    if request.method == 'POST':
        post.pinned = not post.pinned
        post.save(update_fields=['pinned'])
    return redirect('/panel/feed/')


@login_required
@module_required('feed')
def feed_comments(request, pk):
    post = get_object_or_404(FeedPost, pk=pk)
    comments = FeedComment.objects.filter(post=post, parent__isnull=True).select_related('user').prefetch_related('replies__user').order_by('created_at')
    if request.method == 'POST':
        action = request.POST.get('action')
        comment_id = request.POST.get('comment_id')
        if action == 'delete' and comment_id:
            FeedComment.objects.filter(id=comment_id).delete()
            messages.success(request, 'Comment deleted.')
        return redirect(f'/panel/feed/{pk}/comments/')
    return render(request, 'panel/feed_comments.html', {
        'post': post,
        'comments': comments,
    })


@login_required(login_url='/panel/login/')
@module_required('feed')
def _save_post(request, post):
    title      = request.POST.get('title', '').strip()
    body       = request.POST.get('body', '').strip()
    post_type  = request.POST.get('post_type', 'general')
    pinned     = request.POST.get('pinned') == 'on'
    allow_comments = request.POST.get('allow_comments') == 'on'
    send_push  = request.POST.get('send_push') == 'on'
    session_id = request.POST.get('session_id') or None
    scheduled  = request.POST.get('scheduled_at', '').strip() or None

    extra_data = request.POST.copy()
    if post_type == 'quiz':
        import json
        extra_data['quiz_options'] = json.dumps(request.POST.getlist('quiz_option'))
    try:
        apply_feed_extras(post, extra_data)
        apply_feed_content(post, extra_data)
    except ValidationError as exc:
        messages.error(request, ' '.join(exc.messages))
        return None

    post.title         = title
    post.body          = body
    post.post_type     = post_type
    post.pinned        = pinned
    post.allow_comments= allow_comments
    post.send_push     = send_push
    post.author        = request.user

    # Image
    if 'image' in request.FILES:
        post.image = request.FILES['image']
    elif request.POST.get('clear_image') == 'on':
        post.image = None

    # Session link
    if session_id:
        try:
            post.session = ScheduleSession.objects.get(pk=session_id)
        except ScheduleSession.DoesNotExist:
            post.session = None
    else:
        post.session = None

    # Scheduled publish
    if scheduled:
        from django.utils.dateparse import parse_datetime
        dt = parse_datetime(scheduled)
        if dt:
            import django.utils.timezone as tz
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            post.scheduled_at  = dt
            post.published_at  = None   # will be set by celery
        else:
            messages.error(request, 'Invalid scheduled datetime.')
            return None
    else:
        post.scheduled_at = None
        if not post.published_at:
            post.published_at = timezone.now()

    post.save()
    return post
