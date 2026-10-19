"""Shared validation for mobile and web feed editors."""
import json

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator

from .models import FeedPost


def apply_feed_content(post, data):
    title = data.get('title', post.title)
    body = data.get('body', post.body)
    if not isinstance(title, str) or not isinstance(body, str):
        raise ValidationError('Title and body must be text.')
    title, body = title.strip(), body.strip()
    if not body or (post.post_type != 'quiz' and not title):
        raise ValidationError('Body is required. Non-quiz posts also require a title.')
    if len(title) > 300:
        raise ValidationError('Title must be at most 300 characters.')
    post.title, post.body = title, body


def apply_feed_extras(post, data):
    link = data.get('link_url', post.link_url)
    if not isinstance(link, str):
        raise ValidationError('Link must be a valid HTTP or HTTPS URL.')
    link = link.strip()
    if link:
        URLValidator(schemes=['http', 'https'])(link)
        if len(link) > 2000:
            raise ValidationError('Link must be at most 2000 characters.')

    post_type = data.get('post_type', post.post_type)
    if not isinstance(post_type, str) or post_type not in dict(FeedPost.POST_TYPES):
        raise ValidationError('Invalid post type.')
    previous = (post.quiz_type, post.quiz_question, post.quiz_options, post.quiz_correct_option)
    if post_type == 'quiz':
        kind = data.get('quiz_type', post.quiz_type)
        question = data.get('quiz_question', post.quiz_question)
        options = data.get('quiz_options', post.quiz_options)
        correct = data.get('quiz_correct_option', post.quiz_correct_option)
        if kind not in ('multiple_choice', 'true_false'):
            raise ValidationError('Choose a quiz type.')
        if not isinstance(question, str) or not question.strip() or len(question.strip()) > 500:
            raise ValidationError('Quiz question must be between 1 and 500 characters.')
        if isinstance(options, str):
            try:
                options = json.loads(options)
            except (ValueError, TypeError):
                raise ValidationError('Quiz options must be a list.')
        if kind == 'true_false':
            options = ['True', 'False']
        if not isinstance(options, list) or not 2 <= len(options) <= 6:
            raise ValidationError('Provide between 2 and 6 options.')
        if any(not isinstance(o, str) or not o.strip() or len(o.strip()) > 200 for o in options):
            raise ValidationError('Each option must be between 1 and 200 characters.')
        options = [o.strip() for o in options]
        if len({o.casefold() for o in options}) != len(options):
            raise ValidationError('Quiz options must be different.')
        if correct in (None, ''):
            correct = None
        else:
            if isinstance(correct, bool) or not (isinstance(correct, int) or (isinstance(correct, str) and correct.isdigit())):
                raise ValidationError('Select a valid correct answer, or choose no correct answer.')
            correct = int(correct)
            if not 0 <= correct < len(options):
                raise ValidationError('Select a valid correct answer.')
        updated = (kind, question.strip(), options, correct)
    else:
        updated = ('', '', [], None)
    if previous != updated and not post._state.adding and post.quiz_responses.exists():
        raise ValidationError('This quiz already has responses. Create a new post to change its question or answers.')
    post.post_type = post_type
    post.link_url = link
    post.quiz_type, post.quiz_question, post.quiz_options, post.quiz_correct_option = updated
