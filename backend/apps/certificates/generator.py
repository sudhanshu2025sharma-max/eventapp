"""
Certificate Generator — Pillow-based text overlay on Canva-designed PNG.
Signature, logos, borders are ALL in the Canva image. This only draws text.
"""
import logging
import os
from PIL import Image, ImageDraw, ImageFont
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# Available fonts on Ubuntu 24.04
FONT_MAP = {
    'DejaVuSans': {
        'regular': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        'bold': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    },
    'DejaVuSerif': {
        'regular': '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
        'bold': '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',
    },
    'LiberationSans': {
        'regular': '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        'bold': '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    },
    'LiberationSerif': {
        'regular': '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
        'bold': '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
    },
    'FreeSans': {
        'regular': '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
        'bold': '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
    },
    'FreeSerif': {
        'regular': '/usr/share/fonts/truetype/freefont/FreeSerif.ttf',
        'bold': '/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf',
    },
    'FreeMono': {
        'regular': '/usr/share/fonts/truetype/freefont/FreeMono.ttf',
        'bold': '/usr/share/fonts/truetype/freefont/FreeMonoBold.ttf',
    },
}


def get_font(bold=False, size=36, family='DejaVuSans'):
    meta = FONT_MAP.get(family) or FONT_MAP['DejaVuSans']
    path = meta['bold'] if bold else meta['regular']
    if not os.path.exists(path):
        for key in ('DejaVuSans', 'LiberationSans', 'FreeSans'):
            alt = FONT_MAP[key]['bold' if bold else 'regular']
            if os.path.exists(alt):
                path = alt
                break
        else:
            return ImageFont.load_default()
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def resolve_field_value(user, data_source, custom_text='', csv_row=None):
    """
    Resolve data. If csv_row is provided, it overrides database lookups.
    This makes Excel uploads the ultimate source of truth.
    """
    if csv_row:
        csv_map = {
            'user.full_name': ['name', 'full_name', 'fullname'],
            'user.email': ['email'],
            'user.designation': ['designation', 'desig'],
            'user.affiliation': ['affiliation', 'institute', 'org'],
            'user.registration_id': ['registration_id', 'reg_id', 'id'],
            'speaker.paper_title': ['paper_title', 'title', 'topic'],
            'csv.award_name': ['award_name', 'award', 'category'],
            'csv.dynamic_text': ['dynamic_text', 'text', 'custom'],
            'custom': ['custom_text', 'custom'],
        }
        possible_keys = csv_map.get(data_source, [data_source.split('.')[-1]])
        for k in possible_keys:
            if k in csv_row and str(csv_row[k]).strip():
                return str(csv_row[k]).strip()

    if data_source == 'custom':
        return custom_text

    if not user:
        return ''

    if data_source == 'user.full_name':
        return user.get_full_name() or user.email.split('@')[0].replace('.', ' ').title()
    elif data_source == 'user.email':
        return user.email or ''
    elif data_source == 'user.designation':
        try:
            sp = getattr(user, 'staff_profile', None)
            return (sp.designation if sp and sp.designation else '') or user.designation or ''
        except Exception:
            return user.designation or ''
    elif data_source == 'user.affiliation':
        return user.affiliation or ''
    elif data_source == 'user.registration_id':
        return getattr(user, 'registration_id', '') or f"ETD-2026-{str(user.id)[:6].upper()}"

    elif data_source == 'speaker.paper_title':
        try:
            from apps.speakers.models import Speaker
            from apps.schedule.models import AcceptedPaper
            speaker = Speaker.objects.filter(user=user).first()
            if speaker:
                if hasattr(speaker, 'session') and speaker.session:
                    paper = AcceptedPaper.objects.filter(session=speaker.session).first()
                    if paper:
                        return paper.title
                name = user.get_full_name()
                if name:
                    paper = AcceptedPaper.objects.filter(authors__icontains=name).first()
                    if paper:
                        return paper.title
                if hasattr(speaker, 'talk_title') and speaker.talk_title:
                    return speaker.talk_title
        except Exception as e:
            logger.error(f"Paper title resolution failed for {user.email}: {e}")
        return ''

    elif data_source == 'speaker.session_name':
        try:
            from apps.speakers.models import Speaker
            speaker = Speaker.objects.filter(user=user).first()
            if speaker and hasattr(speaker, 'session') and speaker.session:
                return speaker.session.title or ''
        except Exception:
            pass
        return ''

    elif data_source == 'event.name':
        return 'ETD 2026 — ETDs in the Age of AI'
    elif data_source == 'event.date':
        return 'September 18–20, 2026'
    elif data_source == 'event.venue':
        return 'IIT Delhi, New Delhi, India'
    elif data_source == 'date.today':
        return timezone.now().strftime('%B %d, %Y')

    return ''


def hex_to_rgb(hex_color):
    """Convert '#1a1a1a' to (26, 26, 26)."""
    h = hex_color.lstrip('#')
    if len(h) != 6:
        return (26, 26, 26)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def fit_text_to_width(draw, text, bold, max_font_size, min_font_size, max_width, family='DejaVuSans'):
    """
    Auto-shrink font size so text fits within max_width pixels.
    Returns (font, actual_size, possibly_truncated_text).
    """
    if max_width <= 0:
        return get_font(bold, max_font_size, family), max_font_size, text

    for size in range(max_font_size, min_font_size - 1, -2):
        font = get_font(bold, size, family)
        bbox = draw.textbbox((0, 0), text, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return font, size, text

    font = get_font(bold, min_font_size, family)
    while len(text) > 1:
        test = text + '…'
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return font, min_font_size, test
        text = text[:-1]
    return font, min_font_size, text


def wrap_text_to_width(draw, text, font, max_width):
    """Wrap text into multiple lines that each fit within max_width."""
    if max_width <= 0:
        return [text]
    words = text.split()
    if not words:
        return ['']
    lines = []
    current = ''
    for word in words:
        test = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or ['']


def generate_certificate_pdf(template, user=None, csv_row=None):
    """
    Generate a certificate PDF for a user from a Canva-designed template.
    Returns the file path relative to MEDIA_ROOT.
    """
    import uuid as _uuid

    img = Image.open(template.bg_image.path).convert('RGBA')
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for field in template.fields.all():
        text = resolve_field_value(user, field.data_source, field.custom_text, csv_row)
        if not text or not text.strip():
            continue
        text = text.strip()

        color = hex_to_rgb(field.font_color)
        family = getattr(field, 'font_family', None) or 'DejaVuSans'

        font, actual_size, text = fit_text_to_width(
            draw, text, field.is_bold,
            field.font_size, field.min_font_size, field.max_width, family
        )

        lines = wrap_text_to_width(draw, text, font, field.max_width)

        line_height_px = int(actual_size * field.line_height)
        total_height = line_height_px * len(lines)

        for i, line in enumerate(lines):
            bbox = draw.textbbox((0, 0), line, font=font)
            line_width = bbox[2] - bbox[0]

            if field.text_align == 'center':
                lx = field.x - line_width // 2
            elif field.text_align == 'right':
                lx = field.x - line_width
            else:
                lx = field.x

            ly = field.y - total_height // 2 + i * line_height_px

            draw.text((lx, ly), line, fill=color, font=font)

    result = Image.alpha_composite(img, overlay)
    result = result.convert('RGB')

    filename = f"cert_{_uuid.uuid4().hex[:12]}.pdf"
    rel_path = f"certificates/{timezone.now().strftime('%Y/%m')}"
    full_dir = os.path.join(settings.MEDIA_ROOT, rel_path)
    os.makedirs(full_dir, exist_ok=True)
    full_path = os.path.join(full_dir, filename)

    result.save(full_path, 'PDF', resolution=300.0)

    return f"{rel_path}/{filename}"
