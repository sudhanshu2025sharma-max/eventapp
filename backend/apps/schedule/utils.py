from datetime import datetime
from zoneinfo import ZoneInfo
from django.utils.dateparse import parse_datetime
from .models import FeedbackForm, FeedbackQuestion

IST = ZoneInfo("Asia/Kolkata")

def _parse_panel_dt(val):
    if not val:
        return None
    dt = parse_datetime(val)
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    else:
        dt = dt.astimezone(IST)
    return dt

def _validate_document(file_obj):
    """Validate file extension and size (max 25MB)."""
    if not file_obj:
        return None
    ext = file_obj.name.split('.')[-1].lower() if '.' in file_obj.name else ''
    if ext not in ['pdf', 'doc', 'docx']:
        return "Only PDF and Word documents (.pdf, .doc, .docx) are allowed."
    if file_obj.size > 25 * 1024 * 1024:
        return "Document size cannot exceed 25MB."
    return None

def _ensure_feedback_form(sess):
    form, created = FeedbackForm.objects.get_or_create(
        session=sess,
        defaults={'title': f'Feedback: {sess.title}'}
    )
    if created:
        defaults = [
            ('How would you rate this session overall?', 'rating', True, 1),
            ('How relevant was the content to your interests?', 'rating', True, 2),
            ('How effective was the speaker/presenter?', 'rating', True, 3),
            ('Any comments or suggestions?', 'text', False, 4),
        ]
        for text, qtype, req, order in defaults:
            FeedbackQuestion.objects.create(
                form=form, question_text=text,
                question_type=qtype, is_required=req, order=order
            )
    return form

def _combine_iso(d, t):
    """Build ISO-like datetime string from DateField + TimeField (wall clock IST)."""
    if not d or not t:
        return None
    return f"{d.isoformat()}T{t.strftime('%H:%M:%S')}+05:30"
