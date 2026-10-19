
def _get_all_participant_categories():
    from apps.accounts.models import ParticipantCategory, User
    db_cats = list(ParticipantCategory.objects.values_list('name', flat=True))
    part_qs = User.objects.exclude(role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff', 'speaker'])
    user_cats = list(filter(None, set(part_qs.values_list('category', flat=True).distinct())))
    combined = sorted(list(set(['Participant'] + db_cats + user_cats)))
    return combined
import csv
import io
import qrcode
from email.mime.image import MIMEImage
from django.core.mail import EmailMultiAlternatives
import secrets
import string
import logging

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core.mail import send_mail
from django.http import HttpResponse
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import ParticipantImport
from apps.accounts.permissions_helper import module_required

try:
    from apps.leaderboard.utils import award_points
    from apps.leaderboard.models import PointAction
    HAS_LEADERBOARD = True
except ImportError:
    HAS_LEADERBOARD = False

logger = logging.getLogger(__name__)
User = get_user_model()

# ── helpers ────────────────────────────────────────────────────────────────

_CSV_HEADERS = [
    'Salutation', 'Full Name', 'Registration ID', 'Email ID', 'Gender',
    'Designation', 'Organisation / Institute',
    'Mobile Number', 'Address', 'PIN / Postal Code', 'Role',
]

_HEADER_MAP = {
    'salutation':               'salutation',
    'full name':                'full_name',
    'registration id':          'registration_id',
    'registration_id':          'registration_id',
    'reg id':                   'registration_id',
    'email id':                 'email',
    'email':                    'email',
    'gender':                   'gender',
    'designation':              'designation',
    'organisation / institute': 'organisation',
    'organisation':             'organisation',
    'organization':             'organisation',
    'mobile number':            'mobile',
    'mobile':                   'mobile',
    'address':                  'address',
    'pin / postal code':        'pin_code',
    'pin':                      'pin_code',
    'postal code':              'pin_code',
    'role':                     'imported_role',
    'category':                 'imported_role',
}


def _generate_temp_password(full_name=''):
    import re, random
    clean = re.sub(r'[^a-zA-Z\s]', '', str(full_name)).strip()
    parts = clean.split()
    base_str = ''
    is_short = False
    for p in parts:
        if len(p) > 2:
            base_str = p
            break
    if not base_str:
        base_str = parts[0] if parts else 'User'
        is_short = True
    base_str = base_str.capitalize()
    if len(base_str) < 4:
        base_str = base_str.ljust(4, 'x')
        is_short = True
    return f'{base_str}@{random.randint(100, 999)}', is_short

def _split_name(full_name):
    parts = full_name.strip().split(None, 1)
    return (parts[0], parts[1]) if len(parts) == 2 else (parts[0] if parts else '', '')


def _next_single_reg_id():
    """Generate next ETD-2026-S-XXX for single-add participants."""
    last = (
        User.objects.filter(registration_id__startswith='ETD-2026-S-')
        .order_by('-registration_id')
        .values_list('registration_id', flat=True)
        .first()
    )
    if last:
        try:
            num = int(last.split('-')[-1]) + 1
        except (ValueError, IndexError):
            num = 1
    else:
        num = 1
    return f'ETD-2026-S-{num:03d}'


def _parse_csv_bytes(raw_bytes):
    rows, errors = [], []

    if _looks_like_excel(raw_bytes):
        return _parse_excel(raw_bytes)

    try:
        text = raw_bytes.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = raw_bytes.decode('latin-1')

    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames:
        return [], ['File appears empty or has no header row.']

    col_map = {}
    for h in reader.fieldnames:
        key = h.strip().lower()
        if key in _HEADER_MAP:
            col_map[h] = _HEADER_MAP[key]

    has_email = any(v == 'email' for v in col_map.values())
    has_name  = any(v == 'full_name' for v in col_map.values())

    if not has_email:
        return [], ['Column "Email ID" is required but not found in the file.']
    if not has_name:
        return [], ['Column "Full Name" is required but not found in the file.']

    for line_num, raw_row in enumerate(reader, start=2):
        row_data = {}
        for csv_col, field in col_map.items():
            row_data[field] = (raw_row.get(csv_col) or '').strip()

        email = row_data.get('email', '').lower()
        if not email:
            errors.append(f"Row {line_num}: empty email — skipped.")
            continue
        if '@' not in email:
            errors.append(f"Row {line_num}: invalid email '{email}' — skipped.")
            continue

        row_data['email'] = email
        rows.append(row_data)

    return rows, errors


def _looks_like_excel(raw_bytes):
    return raw_bytes[:4] == b'PK\x03\x04'


def _parse_excel(raw_bytes):
    try:
        import openpyxl
    except ImportError:
        return [], ['Excel files require openpyxl. Upload a CSV instead, or run: pip install openpyxl']

    rows, errors = [], []
    wb = openpyxl.load_workbook(io.BytesIO(raw_bytes), read_only=True, data_only=True)
    ws = wb.active

    all_rows = list(ws.iter_rows(values_only=True))
    if not all_rows:
        return [], ['Excel file is empty.']

    headers = [str(h).strip() if h is not None else '' for h in all_rows[0]]

    col_map = {}
    for i, h in enumerate(headers):
        key = h.lower()
        if key in _HEADER_MAP:
            col_map[i] = _HEADER_MAP[key]

    has_email = any(v == 'email' for v in col_map.values())
    has_name  = any(v == 'full_name' for v in col_map.values())
    if not has_email:
        return [], ['Column "Email ID" is required but not found.']
    if not has_name:
        return [], ['Column "Full Name" is required but not found.']

    for line_num, data_row in enumerate(all_rows[1:], start=2):
        row_data = {}
        for idx, field in col_map.items():
            val = data_row[idx] if idx < len(data_row) else None
            row_data[field] = str(val).strip() if val is not None else ''

        email = row_data.get('email', '').lower()
        if not email:
            errors.append(f"Row {line_num}: empty email — skipped.")
            continue
        if '@' not in email:
            errors.append(f"Row {line_num}: invalid email '{email}' — skipped.")
            continue

        row_data['email'] = email
        rows.append(row_data)

    return rows, errors


def _send_credentials_email(email, full_name, temp_password, registration_id=None):
    if not registration_id:
        try:
            u = User.objects.get(email=email)
            registration_id = u.registration_id
        except User.DoesNotExist:
            registration_id = None

    reg_id_display = registration_id if registration_id else "ETD-2026-PARTICIPANT"

    # Generate QR Code image in memory
    qr_img = qrcode.make(reg_id_display)
    buffer = io.BytesIO()
    qr_img.save(buffer, format="PNG")
    qr_bytes = buffer.getvalue()

    subject = f"ETD 2026 — Official Welcome & Registration Pass [{reg_id_display}]"

    text_content = f"""Dear {full_name},

Welcome to ETD 2026 — "ETDs in the Age of AI" at IIT Delhi!

Your participant account has been created. Use the details below to access your account:

OFFICIAL REGISTRATION DETAILS:
Full Name:       {full_name}
Registration ID: {reg_id_display}
Email Address:   {email}
Temporary Pass:  {temp_password}
(Note: You will be asked to change your password on first login.)

CHECK-IN INSTRUCTIONS:
Present the attached Registration QR Pass at the main hall check-in desk to receive your official conference badge and conference kit.

MOBILE APP DOWNLOAD:
• Google Play Store: https://play.google.com
• Apple App Store:   https://apps.apple.com

ETD 2026 Web Site:
Login at: https://etd2026.iitd.ac.in

Regards,
ETD 2026 Organising Committee
Central Library, IIT Delhi
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #0f172a; }}
  .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }}
  .header {{ background: linear-gradient(135deg, #0333b6, #0f172a); padding: 32px 24px; text-align: center; color: #ffffff; }}
  .header h1 {{ margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }}
  .header p {{ margin: 6px 0 0 0; font-size: 13px; opacity: 0.85; }}
  .content {{ padding: 28px 24px; }}
  .salutation {{ font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }}
  .intro {{ font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 20px; }}
  
  .card {{ background: #f1f5f9; border-radius: 12px; padding: 18px; border: 1px solid #cbd5e1; margin-bottom: 24px; }}
  .card-title {{ font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }}
  .row {{ margin-bottom: 8px; font-size: 14px; }}
  .row-label {{ color: #64748b; font-weight: 500; display: inline-block; width: 140px; }}
  .row-value {{ color: #0f172a; font-weight: 700; font-family: monospace; font-size: 14px; }}
  
  .qr-section {{ text-align: center; background: #faf5ff; border: 1.5px dashed #c084fc; border-radius: 16px; padding: 20px; margin-bottom: 24px; }}
  .qr-title {{ font-size: 15px; font-weight: 800; color: #6b21a8; margin-bottom: 4px; }}
  .qr-sub {{ font-size: 12px; color: #7e22ce; margin-bottom: 14px; }}
  .qr-img {{ width: 180px; height: 180px; background: #ffffff; padding: 8px; border-radius: 12px; border: 1px solid #e9d5ff; }}
  
  .app-section {{ background: #eff6ff; border-radius: 12px; padding: 18px; border: 1px solid #bfdbfe; margin-bottom: 20px; text-align: center; }}
  .app-title {{ font-size: 14px; font-weight: 800; color: #1e40af; margin-bottom: 6px; }}
  .app-sub {{ font-size: 12px; color: #3b82f6; margin-bottom: 12px; }}
  .btn {{ display: inline-block; background: #0333b6; color: #ffffff !important; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; margin: 4px; }}
  .btn-alt {{ background: #0f172a; }}
  
  .footer {{ background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; line-height: 1.6; }}
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ETD 2026 — IIT Delhi</h1>
      <p>ETDs in the Age of AI | International Conference</p>
    </div>
    
    <div class="content">
      <div class="salutation">Dear {full_name},</div>
      <div class="intro">
        Welcome to <strong>ETD 2026</strong>! Your registration account has been successfully created. Please find your official credentials and Venue Access Pass below:
      </div>
      
      <div class="card">
        <div class="card-title">Registration & Login Credentials</div>
        <div class="row"><span class="row-label">Full Name:</span><span class="row-value">{full_name}</span></div>
        <div class="row"><span class="row-label">Registration ID:</span><span class="row-value" style="color: #0333b6;">{reg_id_display}</span></div>
        <div class="row"><span class="row-label">Email Address:</span><span class="row-value">{email}</span></div>
        <div class="row"><span class="row-label">Temp Password:</span><span class="row-value" style="color: #d97706;">{temp_password}</span></div>
      </div>
      
      <div class="qr-section">
        <div class="qr-title">Your Registration Check-In Pass</div>
        <div class="qr-sub">Present this QR code or Reg ID (<strong>{reg_id_display}</strong>) at the venue desk</div>
        <img src="cid:qrcode_image" class="qr-img" alt="Check-in QR Pass" />
      </div>

      <div class="app-section">
        <div class="app-title">📱 Download ETD 2026 Mobile App</div>
        <div class="app-sub">Get live schedule updates, meal passes, interactive venue maps, and networking:</div>
        <div>
          <a href="https://play.google.com/store/apps/details?id=ac.in.iitd.etd2026" class="btn">Google Play Store</a>
          <a href="https://apps.apple.com/app/etd-2026/id123456789" class="btn btn-alt">Apple App Store</a>
        </div>
      </div>
      
      <div style="font-size: 12px; color: #64748b;">
        <strong>Web Site:</strong> Access the conference web site at <a href="https://etd2026.iitd.ac.in" style="color: #0333b6;">https://etd2026.iitd.ac.in</a>.
      </div>
    </div>
    
    <div class="footer">
      Organising Committee, ETD 2026<br/>
      Central Library, Indian Institute of Technology Delhi, Hauz Khas, New Delhi - 110016<br/>
      Website: <a href="https://etd2026.iitd.ac.in" style="color: #0333b6;">https://etd2026.iitd.ac.in</a>
    </div>
  </div>
</body>
</html>
"""

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=None,
            to=[email]
        )
        msg.attach_alternative(html_content, "text/html")

        # Inline QR Code image
        image = MIMEImage(qr_bytes)
        image.add_header('Content-ID', '<qrcode_image>')
        image.add_header('Content-Disposition', 'inline', filename=f"QR_{reg_id_display}.png")
        msg.attach(image)

        # File Attachment
        msg.attach(f"ETD2026_CheckIn_Pass_{reg_id_display}.png", qr_bytes, "image/png")

        msg.send(fail_silently=False)
        return True
    except Exception as exc:
        logger.error("Email failed for %s: %s", email, exc)
        return False


# ── auth views ─────────────────────────────────────────────────────────────

def admin_login(request):
    next_url = request.GET.get('next') or request.POST.get('next') or 'admin_dashboard'
    if request.user.is_authenticated:
        return redirect(next_url)

    from apps.conferences.models import ConferenceSetting
    conf = ConferenceSetting.get()

    if request.method == 'POST':
        email    = (request.POST.get('email') or request.POST.get('username') or '').strip().lower()
        password = request.POST.get('password', '')
        # Try authenticating with lowercase email first, then exact input
        user     = authenticate(request, username=email, password=password)
        if not user:
            # Fallback if DB holds mixed-case email
            matched = User.objects.filter(email__iexact=email).first()
            if matched:
                user = authenticate(request, username=matched.email, password=password)

        if user is not None and user.role in ('super_admin', 'mgmt_admin', 'team_head', 'staff'):
            login(request, user)
            return redirect(next_url)
        elif user is not None:
            messages.error(request, 'You do not have admin access.')
        else:
            messages.error(request, 'Invalid email or password.')

    return render(request, 'panel/login.html', {'conf': conf})


@login_required(login_url='/panel/login/')
def admin_logout(request):
    logout(request)
    return redirect('/panel/login/')


# ── dashboard ──────────────────────────────────────────────────────────────

@login_required(login_url='/panel/login/')
def admin_dashboard(request):
    from apps.checkins.models import CheckIn, MealPass, MealWindow
    from apps.photos.models import Photo
    from apps.polls.models import Poll
    from apps.schedule.models import ScheduleSession
    from django.utils import timezone

    today = timezone.now().date()

    # 1. Participants & Check-Ins
    total_participants = User.objects.filter(role='participant').count()
    checked_in = CheckIn.objects.filter(checkin_type='conference').values('user_id').distinct().count()
    checkin_pct = round(checked_in * 100 / total_participants) if total_participants else 0
    profile_complete_pct = round(
        User.objects.filter(role='participant', profile_complete=True).count() * 100 / total_participants
    ) if total_participants else 0

    # 2. Photos & Pending Moderation
    try:
        photos_uploaded = Photo.objects.count()
        photos_pending = Photo.objects.filter(status='pending').count()
    except Exception:
        photos_uploaded = 0
        photos_pending = 0

    # 3. Active Polls
    try:
        active_polls = Poll.objects.filter(is_active=True).count()
    except Exception:
        active_polls = 0

    # 4. Ideathon Teams
    try:
        from apps.polls.models import IdeathonTeam
        ideathon_teams_count = IdeathonTeam.objects.count()
    except Exception:
        ideathon_teams_count = 0

    # 5. Today Meals Scanned & Window Status
    try:
        today_meals_count = MealPass.objects.filter(scanned_at__date=today).count()
        current_meal_window = MealWindow.objects.filter(date=today, is_open=True).first()
    except Exception:
        today_meals_count = 0
        current_meal_window = None

    # 6. Today Schedule
    today_events = []
    try:
        today_sessions = ScheduleSession.objects.filter(date=today).order_by('start_time')[:6]
        now_time = timezone.now().time()
        for s in today_sessions:
            status = 'upcoming'
            if s.start_time and s.end_time:
                if s.start_time <= now_time <= s.end_time:
                    status = 'live'
                elif now_time > s.end_time:
                    status = 'completed'
            today_events.append({
                'title': s.title,
                'time': f"{s.start_time.strftime('%H:%M')} - {s.end_time.strftime('%H:%M')}" if s.start_time and s.end_time else "TBD",
                'room': s.location or "Main Hall",
                'status': status,
                'speaker': s.speaker_name or ""
            })
    except Exception:
        today_events = []

    # 7. Recent Check-Ins Stream
    recent_checkins = []
    try:
        raw_checkins = (
            CheckIn.objects.filter(checkin_type='conference')
            .select_related('user')
            .order_by('-scanned_at')[:7]
        )
        for c in raw_checkins:
            user_obj = c.user
            name = user_obj.get_full_name() if user_obj else "Participant"
            if not name.strip() and user_obj:
                name = user_obj.email.split('@')[0]
            
            recent_checkins.append({
                'name': name,
                'email': user_obj.email if user_obj else '',
                'id': f"#{str(user_obj.id)[:8]}" if user_obj else '',
                'time': c.scanned_at.astimezone(timezone.get_current_timezone()).strftime('%H:%M:%S') if c.scanned_at else '',
                'goodies': getattr(c, 'goodies_status', False)
            })
    except Exception:
        recent_checkins = []

    context = {
        'total_participants': total_participants,
        'checked_in': checked_in,
        'checkin_percent': checkin_pct,
        'profile_complete_percent': profile_complete_pct,
        'photos_uploaded': photos_uploaded,
        'photos_pending': photos_pending,
        'active_polls': active_polls,
        'ideathon_teams_count': ideathon_teams_count,
        'today_meals_count': today_meals_count,
        'current_meal_window': current_meal_window,
        'today_events': today_events,
        'recent_checkins': recent_checkins,
    }
    return render(request, 'panel/dashboard.html', context)


# ── participant import ─────────────────────────────────────────────────────

@login_required(login_url='/panel/login/')
@module_required('participants')
def participants_upload(request):
    if request.method == 'POST':
        if request.POST.get('action') == 'add_category':
            from apps.accounts.models import ParticipantCategory
            new_cat = request.POST.get('new_category_name', '').strip()
            if new_cat:
                ParticipantCategory.objects.get_or_create(name=new_cat)
                messages.success(request, f"New category '{new_cat}' created successfully!")
            return redirect('participants_upload')
        if request.POST.get('action') == 'delete_category':
            from apps.accounts.models import ParticipantCategory
            cat_to_del = request.POST.get('category_name', '').strip()
            if cat_to_del:
                part_qs = User.objects.exclude(role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff', 'speaker']).filter(category__iexact=cat_to_del)
                user_count = part_qs.count()
                if user_count > 0:
                    messages.error(request, f"Cannot delete '{cat_to_del}': {user_count} participant(s) currently belong to it.")
                else:
                    ParticipantCategory.objects.filter(name__iexact=cat_to_del).delete()
                    messages.success(request, f"Category '{cat_to_del}' deleted.")
            return redirect('participants_upload')
        f = request.FILES.get('csv_file')
        if not f:
            messages.error(request, 'Please select a file.')
            return redirect('participants_upload')

        raw = f.read()
        rows, errors = _parse_csv_bytes(raw)

        if not rows and errors:
            for e in errors:
                messages.error(request, e)
            return redirect('participants_upload')

        ParticipantImport.objects.filter(
            uploaded_by=request.user, status='pending'
        ).delete()

        default_cat = request.POST.get('default_category', '').strip() or 'Participant'
        objs = []
        for r in rows:
            cat_val = r.get('category') or r.get('imported_role') or default_cat
            r['category'] = cat_val
            r['imported_role'] = cat_val
            objs.append(ParticipantImport(uploaded_by=request.user, **r))
        ParticipantImport.objects.bulk_create(objs, ignore_conflicts=False)

        if errors:
            messages.warning(request, f"{len(errors)} row(s) skipped: " + " | ".join(errors))

        messages.success(request, f"{len(rows)} row(s) staged for review.")
        return redirect('participants_preview')

    all_cats = _get_all_participant_categories()
    from django.db.models import Count
    base_qs = User.objects.exclude(role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff', 'speaker'])
    raw_cats = list(base_qs.values('category').annotate(count=Count('id')))
    cat_counts = {}
    for item in raw_cats:
        cname = (item['category'] or '').strip() or 'Participant'
        cat_counts[cname] = cat_counts.get(cname, 0) + item['count']

    for dc in _get_all_participant_categories():
        if dc not in cat_counts:
            cat_counts[dc] = 0

    return render(request, 'panel/participants_upload.html', {
        'category_stats': cat_counts,
        'categories': sorted(list(cat_counts.keys()))
    })


@login_required(login_url='/panel/login/')
@module_required('participants')
def participants_preview(request):
    pending = ParticipantImport.objects.filter(
        uploaded_by=request.user, status='pending'
    ).order_by('id')

    existing_email_map = dict(
        User.objects.filter(
            email__in=[p.email for p in pending]
        ).values_list('email', 'first_name')
    )

    existing_reg_map = dict(
        User.objects.filter(
            registration_id__in=[p.registration_id for p in pending if p.registration_id]
        ).values_list('registration_id', 'email')
    )

    rows_display = []
    for p in pending:
        dup_reason = ''
        if p.email in existing_email_map:
            dup_reason = f"Email exists in system"
        elif p.registration_id and p.registration_id in existing_reg_map:
            owner = existing_reg_map[p.registration_id]
            dup_reason = f"Reg ID '{p.registration_id}' used by {owner}"
        rows_display.append({
            'obj': p,
            'duplicate': bool(dup_reason),
            'dup_reason': dup_reason,
        })

    duplicates = sum(1 for r in rows_display if r['duplicate'])

    return render(request, 'panel/participants_preview.html', {
        'rows': rows_display,
        'total': pending.count(),
        'duplicates': duplicates,
    })


@login_required(login_url='/panel/login/')
@module_required('participants')
def participants_delete_row(request, pk):
    if request.method == 'POST':
        ParticipantImport.objects.filter(
            pk=pk, uploaded_by=request.user, status='pending'
        ).delete()
    return redirect('participants_preview')


@login_required(login_url='/panel/login/')
@module_required('participants')
def participants_confirm(request):
    if request.method != 'POST':
        return redirect('participants_preview')

    pending = ParticipantImport.objects.filter(
        uploaded_by=request.user, status='pending'
    )

    if not pending.exists():
        messages.error(request, 'Nothing to import.')
        return redirect('participants_upload')

    created_count = 0
    skipped_count = 0

    for staged in pending:
        if User.objects.filter(email=staged.email).exists():
            staged.status     = 'failed'
            staged.error_note = 'Email already registered.'
            staged.save(update_fields=['status', 'error_note'])
            skipped_count += 1
            continue

# Registration ID duplicate check removed to allow shared group/sponsor IDs

        first_name, last_name = _split_name(staged.full_name)
        manual_pwd = request.POST.get('temp_password', '').strip()
        auto_pwd, _ = _generate_temp_password(staged.full_name)
        temp_password = manual_pwd if manual_pwd else auto_pwd

        try:
            with transaction.atomic():
                User.objects.create_user(
                    email           = staged.email,
                    password        = temp_password,
                    temp_password   = temp_password,
                    first_name      = first_name,
                    last_name       = last_name,
                    phone           = staged.mobile,
                    affiliation     = staged.organisation,
                    designation     = staged.designation,
                    gender          = staged.gender,
                    registration_id = staged.registration_id or None,
                    category        = getattr(staged, 'category', '') or staged.imported_role or 'Participant',
                    role            = 'sponsor_del' if 'sponsor' in (staged.imported_role or '').lower() else 'participant',
                    must_change_password = True,
                    is_active       = True,
                )
                staged.status = 'imported'
                staged.temp_password = temp_password
                staged.save(update_fields=['status', 'temp_password'])

            if HAS_LEADERBOARD:
                try:
                    award_points(User.objects.get(email=staged.email), PointAction.SIGNUP, 'Welcome to ETD 2026')
                except Exception:
                    pass

            created_count += 1

        except Exception as exc:
            logger.exception("Failed to create user for %s", staged.email)
            staged.status     = 'failed'
            staged.error_note = str(exc)[:400]
            staged.save(update_fields=['status', 'error_note'])
            skipped_count += 1

    msg = f"Import done: {created_count} created, {skipped_count} skipped."
    if created_count > 0:
        msg += " 📥 Download the credentials CSV below to mail-merge login details."
    messages.success(request, msg)
    return redirect('participants_list')


@login_required(login_url='/panel/login/')
@module_required('participants')
def participants_list(request):
    from apps.checkins.models import CheckIn
    from django.db.models import Count, Q

    search = request.GET.get('search', '').strip()
    status_filter = request.GET.get('status', '').strip()
    selected_category = request.GET.get('category', '').strip()

    # Handle Actions (Add Category, Delete Selected, Delete Category)
    if request.method == 'POST':
        action = request.POST.get('action')
        from apps.accounts.models import ParticipantCategory

        if action == 'add_category':
            new_cat = request.POST.get('new_category_name', '').strip()
            if new_cat:
                ParticipantCategory.objects.get_or_create(name=new_cat)
                messages.success(request, f"New category '{new_cat}' created successfully!")
                return redirect(f"/panel/participants/?category={new_cat}")

        elif action == 'bulk_delete':
            user_ids = request.POST.getlist('selected_ids')
            if user_ids:
                part_qs = User.objects.exclude(
                    role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff', 'speaker']
                ).filter(id__in=user_ids)
                count = part_qs.count()
                part_qs.delete()
                messages.success(request, f"Successfully deleted {count} selected participant(s).")
            else:
                messages.warning(request, "No participants selected for deletion.")
            return redirect('participants_list')

        elif action == 'delete_entire_category':
            cat_to_del = request.POST.get('category_name', '').strip()
            if cat_to_del:
                # Delete all participant users under this category
                if cat_to_del == 'Participant':
                    part_qs = User.objects.exclude(
                        role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff', 'speaker']
                    ).filter(Q(category__iexact='Participant') | Q(category='') | Q(category__isnull=True))
                else:
                    part_qs = User.objects.exclude(
                        role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff', 'speaker']
                    ).filter(category__iexact=cat_to_del)
                
                user_count = part_qs.count()
                part_qs.delete()
                ParticipantCategory.objects.filter(name__iexact=cat_to_del).delete()
                messages.success(request, f"Deleted category '{cat_to_del}' and all {user_count} participant(s) in it.")
            return redirect('participants_list')

        elif action == 'delete_category':
            cat_to_del = request.POST.get('category_name', '').strip()
            if cat_to_del:
                part_qs = User.objects.exclude(
                    role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff', 'speaker']
                ).filter(category__iexact=cat_to_del)
                user_count = part_qs.count()
                if user_count > 0:
                    messages.error(request, f"Cannot delete '{cat_to_del}': {user_count} participant(s) currently belong to it. Use 'Delete Category & All Participants' instead.")
                else:
                    ParticipantCategory.objects.filter(name__iexact=cat_to_del).delete()
                    messages.success(request, f"Category '{cat_to_del}' deleted.")
            return redirect('participants_list')

    base_qs = User.objects.exclude(role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff', 'speaker'])

    # Category stats & counts
    raw_cats = list(base_qs.values('category').annotate(count=Count('id')))
    category_counts = {}
    total_participants = 0
    for item in raw_cats:
        cname = (item['category'] or '').strip() or 'Participant'
        category_counts[cname] = category_counts.get(cname, 0) + item['count']
        total_participants += item['count']

    # Ensure all registered categories appear even if count is 0
    for dc in _get_all_participant_categories():
        if dc not in category_counts:
            category_counts[dc] = 0

    qs = base_qs.order_by('first_name', 'last_name')

    if selected_category:
        if selected_category == 'Participant':
            qs = qs.filter(Q(category__iexact='Participant') | Q(category='') | Q(category__isnull=True))
        else:
            qs = qs.filter(category__iexact=selected_category)
    if search:
        qs = qs.filter(
            Q(first_name__icontains=search) | Q(last_name__icontains=search) |
            Q(email__icontains=search) | Q(registration_id__icontains=search)
        )

    # Fetch all checked-in participant map with kit status & notes
    checkin_map = {
        c.user_id: c for c in CheckIn.objects.filter(checkin_type='conference')
    }
    checked_in_ids = set(checkin_map.keys())

    total_all = User.objects.filter(role__in=['participant', 'sponsor_del', 'guest', 'invited_guest']).count()
    all_participant_ids = set(User.objects.filter(role__in=['participant', 'sponsor_del', 'guest', 'invited_guest']).values_list('id', flat=True))
    total_checked_in = len(checked_in_ids.intersection(all_participant_ids))
    total_not_checked_in = total_all - total_checked_in
    password_set = User.objects.filter(role__in=['participant', 'sponsor_del', 'guest', 'invited_guest'], must_change_password=False).count()

    participants = list(qs)
    creds = dict(ParticipantImport.objects.filter(status='imported').exclude(temp_password='').values_list('email', 'temp_password'))
    for p in participants:
        p.temp_pwd = creds.get(p.email, '')
        c = checkin_map.get(p.id)
        p.is_checked_in = c is not None
        p.goodies_status = getattr(c, 'goodies_status', 'pending') if c else 'pending'
        p.goodies_note = getattr(c, 'goodies_note', '') if c else ''

    if status_filter == 'checked_in':
        participants = [p for p in participants if p.is_checked_in]
    elif status_filter == 'not_checked_in':
        participants = [p for p in participants if not p.is_checked_in]

    return render(request, 'panel/participants_list.html', {
        'participants': participants,
        'total': total_all,
        'total_checked_in': total_checked_in,
        'total_not_checked_in': total_not_checked_in,
        'password_set': password_set,
        'password_pending': total_all - password_set,
        'search': search,
        'status_filter': status_filter,
        'category_counts': category_counts,
        'selected_category': selected_category,
        'total_participants': total_participants,
        'showing': len(participants),
    })


@login_required(login_url='/panel/login/')
@module_required('participants')
def participant_add(request):
    """Add a single participant manually."""
    if request.method == 'POST':
        email = request.POST.get('email', '').strip().lower()
        full_name = request.POST.get('full_name', '').strip()

        if not email or not full_name:
            messages.error(request, 'Full Name and Email are required.')
            return render(request, 'panel/participant_add.html', {'form': request.POST})

        if User.objects.filter(email=email).exists():
            messages.error(request, f'Email {email} is already registered.')
            return render(request, 'panel/participant_add.html', {'form': request.POST})

        first_name, last_name = _split_name(full_name)
        category = request.POST.get('category', '').strip() or 'Participant'
        custom_reg_id = request.POST.get('registration_id', '').strip()
        reg_id = custom_reg_id if custom_reg_id else _next_single_reg_id()
        manual_pwd = request.POST.get('temp_password', '').strip()
        auto_pwd, is_short = _generate_temp_password(full_name)
        temp_password = manual_pwd if manual_pwd else auto_pwd

        if category:
            from .models import ParticipantCategory
            ParticipantCategory.objects.get_or_create(name=category)

        try:
            User.objects.create_user(
                email           = email,
                password        = temp_password,
                temp_password   = temp_password,
                category        = category,
                first_name      = first_name,
                last_name       = last_name,
                phone           = request.POST.get('mobile', '').strip(),
                affiliation     = request.POST.get('organisation', '').strip(),
                designation     = request.POST.get('designation', '').strip(),
                gender          = request.POST.get('gender', '').strip(),
                registration_id = reg_id,
                role            = 'sponsor_del' if 'sponsor' in category.lower() else 'participant',
                must_change_password = True,
                is_active       = True,
            )
            from .models import ParticipantImport
            ParticipantImport.objects.create(
                uploaded_by=request.user, full_name=full_name, email=email,
                registration_id=reg_id, status='imported', temp_password=temp_password,
                organisation=request.POST.get('organisation', '').strip(),
                category=category
            )
        except Exception as exc:
            messages.error(request, f'Error creating user: {exc}')
            return render(request, 'panel/participant_add.html', {'form': request.POST})

        if HAS_LEADERBOARD:
            try:
                award_points(User.objects.get(email=email), PointAction.SIGNUP, 'Welcome to ETD 2026')
            except Exception:
                pass

        send_email = request.POST.get('send_email') == 'on'
        if send_email:
            ok = _send_credentials_email(email, full_name, temp_password, registration_id=reg_id)
            if not ok:
                messages.warning(request, f'User created ({reg_id}) but credential email failed.')
                return redirect('participants_list')

        email_note = ' and credentials emailed' if send_email else ''
        messages.success(request, f'{full_name} added ({reg_id}){email_note}.')
        return redirect('participants_list')

    return render(request, 'panel/participant_add.html', {
        'form': {},
        'next_reg_id': _next_single_reg_id(),
    })


@login_required(login_url='/panel/login/')
@module_required('participants')
def participant_edit(request, pk):
    user = get_object_or_404(User, pk=pk, role='participant')

    if request.method == 'POST':
        user.first_name      = request.POST.get('first_name', user.first_name).strip()
        user.last_name       = request.POST.get('last_name', user.last_name).strip()
        user.email           = request.POST.get('email', user.email).strip().lower()
        user.phone           = request.POST.get('phone', user.phone).strip()
        user.affiliation     = request.POST.get('affiliation', user.affiliation).strip()
        user.designation     = request.POST.get('designation', '').strip()
        user.gender          = request.POST.get('gender', '').strip()
        new_reg = request.POST.get('registration_id', '').strip()
        if new_reg:
            user.registration_id = new_reg

        # Optional manual password reset
        new_pwd = request.POST.get('new_password', '').strip()
        if new_pwd:
            user.set_password(new_pwd)
            if request.POST.get('must_change_password') == 'on':
                user.must_change_password = True
            else:
                user.must_change_password = False
            messages.info(request, f'Password updated for {user.get_full_name()}.')

        try:
            user.save()
            messages.success(request, f'Updated {user.get_full_name()} successfully.')
        except Exception as exc:
            messages.error(request, f'Error: {exc}')
            return render(request, 'panel/participant_edit.html', {'participant': user})

        return redirect('participants_list')

    return render(request, 'panel/participant_edit.html', {'participant': user})


@login_required(login_url='/panel/login/')
@module_required('participants')
def participant_delete(request, pk):
    user = get_object_or_404(User, pk=pk, role='participant')

    if request.method == 'POST':
        name = user.get_full_name()
        user.delete()
        messages.success(request, f'Deleted {name}.')

    return redirect('participants_list')


# ── CSV template download ──────────────────────────────────────────────────

@login_required(login_url='/panel/login/')
@module_required('participants')
def participants_template(request):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="etd2026_participants_template.csv"'

    writer = csv.writer(response)
    writer.writerow(_CSV_HEADERS)
    writer.writerow(['Dr.', 'Amit Kumar', 'ETD-2026-R-001', 'amit.kumar@example.com', 'Male',
                     'Associate Professor', 'IIT Delhi', '9876543210',
                     '123 Main Street, New Delhi', '110016', 'Participant'])
    return response


# ── forgot password ────────────────────────────────────────────────────────

from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str


def password_reset_request(request):
    if request.method == 'POST':
        email = request.POST.get('email', '').strip().lower()
        try:
            user = User.objects.get(email=email, is_active=True)
            uid   = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)

            reset_link = request.build_absolute_uri(
                f'/panel/password-reset-confirm/{uid}/{token}/'
            )
            send_mail(
                subject  = 'ETD 2026 — Password Reset',
                message  = (
                    f"Hi {user.get_full_name() or user.email},\n\n"
                    f"Click the link below to reset your ETD 2026 password:\n\n"
                    f"  {reset_link}\n\n"
                    f"This link expires in 24 hours. If you didn't request this, ignore this email.\n\n"
                    f"Regards,\nETD 2026 Team"
                ),
                from_email = None,
                recipient_list = [email],
                fail_silently  = False,
            )
        except User.DoesNotExist:
            pass

        messages.success(request, 'If that email is registered, a reset link has been sent.')
        return redirect('password_reset_request')

    return render(request, 'panel/password_reset_request.html')


def password_reset_confirm(request, uidb64, token):
    try:
        uid  = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (User.DoesNotExist, ValueError, TypeError):
        user = None

    valid = user is not None and default_token_generator.check_token(user, token)

    if request.method == 'POST' and valid:
        p1 = request.POST.get('password1', '')
        p2 = request.POST.get('password2', '')
        if len(p1) < 8:
            messages.error(request, 'Password must be at least 8 characters.')
        elif p1 != p2:
            messages.error(request, 'Passwords do not match.')
        else:
            user.set_password(p1)
            user.must_change_password = False
            user.save(update_fields=['password', 'must_change_password'])
            messages.success(request, 'Password updated. You can now log in.')
            return redirect('/panel/login/')

    return render(request, 'panel/password_reset_confirm.html', {
        'valid_link': valid,
        'uidb64': uidb64,
        'token': token,
    })


# ── user management (warn / suspend / unsuspend / UGC reports) ────────────

@login_required(login_url='/panel/login/')
@module_required('users_manage')
def users_manage(request):
    search        = request.GET.get('search', '').strip()
    role          = request.GET.get('role', '').strip()
    status_filter = request.GET.get('status', '').strip()

    from .models import UserReport
    from django.db.models import Count, Q

    qs = User.objects.all().annotate(
        pending_reports_count=Count('reports_received', filter=Q(reports_received__status='pending')),
        total_reports_count=Count('reports_received'),
    ).order_by('-pending_reports_count', 'role', 'first_name', 'last_name')

    if search:
        qs = qs.filter(
            Q(first_name__icontains=search) | Q(last_name__icontains=search) |
            Q(email__icontains=search) | Q(registration_id__icontains=search)
        )
    if role:
        qs = qs.filter(role=role)

    if status_filter == 'reported':
        qs = qs.filter(pending_reports_count__gt=0)
    elif status_filter == 'suspended':
        qs = qs.filter(is_active=False)
    elif status_filter == 'warned':
        qs = qs.exclude(warning_note='')

    roles = User.Role.choices

    total_reported_users = User.objects.annotate(
        pr_count=Count('reports_received', filter=Q(reports_received__status='pending'))
    ).filter(pr_count__gt=0).count()

    return render(request, 'panel/users_manage.html', {
        'users': qs,
        'total': User.objects.count(),
        'suspended_count': User.objects.filter(is_active=False).count(),
        'warned_count': User.objects.exclude(warning_note='').count(),
        'reported_count': total_reported_users,
        'search': search,
        'role_filter': role,
        'status_filter': status_filter,
        'roles': roles,
    })


@login_required(login_url='/panel/login/')
@module_required('users_manage')
def user_warn(request, pk):
    user_target = get_object_or_404(User, pk=pk)
    if user_target.role in ('super_admin', 'mgmt_admin'):
        messages.error(request, 'Cannot warn admin accounts.')
        return redirect('users_manage')

    if request.method == 'POST':
        note = request.POST.get('note', '').strip()
        if not note:
            messages.error(request, 'Warning note is required.')
            return redirect('users_manage')

        user_target.warning_note = note
        user_target.warning_acknowledged = False
        user_target.warning_acknowledged_at = None
        user_target.warning_response = ''
        user_target.save(update_fields=['warning_note', 'warning_acknowledged', 'warning_acknowledged_at', 'warning_response'])

        try:
            from apps.notifications.models import Notification as Notif
            from apps.notifications import fcm
            notif = Notif.objects.create(
                title='⚠️ Warning from Admin',
                body=note,
                target_type='user', target_user=user_target,
                sent_by=request.user, status='pending',
                data={'type': 'admin_warning'},
            )
            s, f, bad = fcm.send_to_user(user_target, notif.title, notif.body, notif.data, notif)
            notif.status = 'sent'; notif.sent_count = s; notif.failed_count = f; notif.save()
        except Exception:
            pass

        messages.success(request, f'Warning sent to {user_target.get_full_name()}.')

    return redirect('users_manage')


@login_required(login_url='/panel/login/')
@module_required('users_manage')
def user_suspend(request, pk):
    user_target = get_object_or_404(User, pk=pk)
    if user_target.role in ('super_admin', 'mgmt_admin'):
        messages.error(request, 'Cannot suspend admin accounts.')
        return redirect('users_manage')

    if request.method == 'POST':
        reason = request.POST.get('reason', '').strip() or 'Account suspended by admin.'
        user_target.is_active = False
        user_target.suspended_reason = reason
        user_target.save(update_fields=['is_active', 'suspended_reason'])

        # Update pending reports to actioned
        from .models import UserReport
        UserReport.objects.filter(reported_user=user_target, status='pending').update(
            status='actioned',
            action_taken=f'Suspended by {request.user.get_full_name() or request.user.email}',
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )

        try:
            from apps.notifications.models import DeviceToken
            DeviceToken.objects.filter(user=user_target).update(is_active=False)
        except Exception:
            pass

        try:
            send_mail(
                subject='ETD 2026 — Account Suspended',
                message=(
                    f"Dear {user_target.get_full_name() or user_target.email},\n\n"
                    f"Your ETD 2026 account has been suspended.\n\n"
                    f"Reason: {reason}\n\n"
                    f"If you believe this is a mistake, please contact the organizing team.\n\n"
                    f"Regards,\nETD 2026 Organising Committee\nIIT Delhi"
                ),
                from_email=None,
                recipient_list=[user_target.email],
                fail_silently=True,
            )
        except Exception:
            pass

        messages.success(request, f'{user_target.get_full_name()} has been suspended.')

    return redirect('users_manage')


@login_required(login_url='/panel/login/')
@module_required('users_manage')
def user_unsuspend(request, pk):
    user_target = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        user_target.is_active = True
        user_target.suspended_reason = ''
        user_target.save(update_fields=['is_active', 'suspended_reason'])
        messages.success(request, f'{user_target.get_full_name()} has been restored.')
    return redirect('users_manage')


@login_required(login_url='/panel/login/')
@module_required('users_manage')
def user_clear_warning(request, pk):
    user_target = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        user_target.warning_note = ''
        user_target.warning_acknowledged = False
        user_target.warning_acknowledged_at = None
        user_target.warning_response = ''
        user_target.save(update_fields=['warning_note', 'warning_acknowledged', 'warning_acknowledged_at', 'warning_response'])
        messages.success(request, f'Warning cleared for {user_target.get_full_name()}.')
    return redirect('users_manage')


@login_required(login_url='/panel/login/')
@module_required('users_manage')
def user_dismiss_reports(request, pk):
    user_target = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        from .models import UserReport
        updated = UserReport.objects.filter(reported_user=user_target, status='pending').update(
            status='dismissed',
            action_taken=f'Dismissed by {request.user.get_full_name() or request.user.email}',
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )
        messages.success(request, f'{updated} pending report(s) for {user_target.get_full_name()} dismissed.')
    return redirect('users_manage')


@login_required(login_url='/panel/login/')
@module_required('users_manage')
def user_reports_modal_data(request, pk):
    from django.http import JsonResponse
    user_target = get_object_or_404(User, pk=pk)
    from .models import UserReport
    reports = UserReport.objects.filter(reported_user=user_target).select_related('reporter').order_by('-created_at')
    data = []
    for r in reports:
        data.append({
            'id': str(r.id),
            'reporter_name': r.reporter.get_full_name() or r.reporter.email,
            'reporter_email': r.reporter.email,
            'reason': r.get_reason_display(),
            'detail': r.detail,
            'status': r.status,
            'action_taken': r.action_taken,
            'created_at': r.created_at.strftime('%d %b %Y, %H:%M'),
        })
    return JsonResponse({
        'user_name': user_target.get_full_name() or user_target.email,
        'user_email': user_target.email,
        'is_active': user_target.is_active,
        'suspended_reason': user_target.suspended_reason,
        'reports': data
    })



# ── Credential Export & Batch Email ─────────────────────────────

@login_required(login_url='/panel/login/')
@module_required('participants')
def participants_export_credentials(request):
    """Download CSV of ALL participants with their temp passwords."""
    participants = User.objects.exclude(
        role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff', 'speaker']
    ).order_by('first_name', 'last_name')

    if not participants.exists():
        messages.warning(request, 'No participants to export.')
        return redirect('participants_list')

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="etd2026_participant_credentials.csv"'

    writer = csv.writer(response)
    writer.writerow(['Full Name', 'Email', 'Temp Password', 'Registration ID', 'Category', 'Affiliation', 'Login URL'])
    for p in participants:
        pwd = p.temp_password if p.must_change_password and p.temp_password else '(Password Changed By User)'
        writer.writerow([
            p.get_full_name(),
            p.email,
            pwd,
            p.registration_id or '',
            p.category or 'Participant',
            p.affiliation or '',
            'https://etd2026.iitd.ac.in/panel/login/',
        ])

    return response


@login_required(login_url='/panel/login/')
@module_required('participants')
def participants_batch_email(request):
    """Upload CSV of emails to send credentials to. Max 30/day (IIT SMTP limit)."""
    from django.core.cache import cache

    if request.method == 'POST':
        f = request.FILES.get('email_csv')
        if not f:
            messages.error(request, 'Please upload a CSV file with an "Email" column.')
            return redirect('participants_batch_email')

        raw = f.read()
        try:
            text = raw.decode('utf-8-sig')
        except UnicodeDecodeError:
            text = raw.decode('latin-1')

        reader = csv.DictReader(io.StringIO(text))
        emails_to_send = []
        for row in reader:
            email = (row.get('Email') or row.get('email') or row.get('Email ID') or '').strip().lower()
            if email and '@' in email:
                emails_to_send.append(email)

        if not emails_to_send:
            messages.error(request, 'No valid emails found in CSV. Column must be named "Email".')
            return redirect('participants_batch_email')

        # Check daily limit
        today_key = f'email_batch_count_{timezone.now().date()}'
        sent_today = cache.get(today_key, 0)
        remaining = max(0, 30 - sent_today)

        if remaining == 0:
            messages.error(request, 'Daily email limit reached (30/day via IIT SMTP). Try again tomorrow.')
            return redirect('participants_batch_email')

        to_send = emails_to_send[:remaining]
        skipped_limit = len(emails_to_send) - len(to_send)

        sent_count = 0
        failed_count = 0
        not_found = 0

        for email in to_send:
            # Find the import record with temp_password
            imp = ParticipantImport.objects.filter(
                email=email, status='imported'
            ).exclude(temp_password='').first()

            if not imp:
                not_found += 1
                continue

            ok = _send_credentials_email(imp.email, imp.full_name, imp.temp_password, registration_id=imp.registration_id)
            if ok:
                sent_count += 1
                imp.temp_password = ''  # Clear after sending
                imp.save(update_fields=['temp_password'])
            else:
                failed_count += 1

        # Update daily counter
        cache.set(today_key, sent_today + sent_count, timeout=86400)

        msg = f"Batch email: {sent_count} sent, {failed_count} failed, {not_found} not found."
        if skipped_limit > 0:
            msg += f" ⚠ {skipped_limit} skipped (daily limit 30)."
        msg += f" ({remaining - sent_count} remaining today)"
        messages.success(request, msg)
        return redirect('participants_list')

    # GET — show upload form
    today_key = f'email_batch_count_{timezone.now().date()}'
    sent_today = cache.get(today_key, 0)
    remaining = max(0, 30 - sent_today)

    pending_credentials = ParticipantImport.objects.filter(
        status='imported'
    ).exclude(temp_password='').count()

    return render(request, 'panel/participants_batch_email.html', {
        'sent_today': sent_today,
        'remaining': remaining,
        'pending_credentials': pending_credentials,
    })


# ── admin_required decorator ───────────────────────────────────────────────

from functools import wraps

def admin_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('/panel/login/')
        if request.user.role not in ('super_admin', 'mgmt_admin'):
            messages.error(request, 'You do not have permission to access this page.')
            return redirect('admin_dashboard')
        return view_func(request, *args, **kwargs)
    return wrapper

from .models import StaffProfile, StaffPermission
from .permissions_helper import ALL_MODULE_KEYS, get_user_permissions, user_has_module_access

@admin_required
def staff_permissions_panel(request):
    """Full CRUD + permissions management for staff."""
    import json
    from django.http import JsonResponse
    from django.db import transaction
    from django.core.cache import cache

    if request.method == 'POST':
        action = request.POST.get('action', '')

        # ── 1. DRAG AND DROP REORDERING ──
        if action == 'reorder':
            ordered_ids = request.POST.get('ordered_ids')
            if ordered_ids:
                try:
                    ids = json.loads(ordered_ids)
                    with transaction.atomic():
                        for index, uid in enumerate(ids, start=1):
                            StaffProfile.objects.filter(user_id=uid).update(order=index)
                    cache.delete('support_committee_team_v2')
                    return JsonResponse({'success': True})
                except Exception as e:
                    return JsonResponse({'success': False, 'error': str(e)})
            return JsonResponse({'success': False, 'error': 'No ids provided'})

        # ── 2. DELETE STAFF ──
        elif action == 'delete':
            user_id = request.POST.get('user_id')
            try:
                u = User.objects.get(id=user_id)
                name = u.get_full_name()
                u.delete()
                messages.success(request, f"{name} deleted.")
            except User.DoesNotExist:
                messages.error(request, "User not found.")
            cache.delete('support_committee_team_v2')
            return redirect('staff_permissions_panel')

        # ── 3. CREATE NEW STAFF ──
        elif action == 'create':
            email = request.POST.get('email', '').strip().lower()
            first_name = request.POST.get('first_name', '').strip()
            last_name = request.POST.get('last_name', '').strip()
            if not email or not first_name:
                messages.error(request, "Email and first name required.")
                return redirect('staff_permissions_panel')
            if User.objects.filter(email=email).exists():
                messages.error(request, "Email already exists.")
                return redirect('staff_permissions_panel')
            
            role = request.POST.get('role', 'staff')
            password = request.POST.get('password', 'Staff@123') or 'Staff@123'
            u = User.objects.create_user(email=email, password=password, first_name=first_name, last_name=last_name, role=role)
            # Auto-generate or accept registration_id
            reg_id = request.POST.get('registration_id', '').strip()
            if not reg_id:
                import re
                existing = list(User.objects.filter(
                    registration_id__startswith='ETD-2026-OT'
                ).values_list('registration_id', flat=True))
                max_num = 0
                for rid in existing:
                    m = re.search(r'OT(\d+)$', rid)
                    if m:
                        max_num = max(max_num, int(m.group(1)))
                reg_id = f'ETD-2026-OT{max_num + 1:02d}'
            u.registration_id = reg_id
            u.save(update_fields=['registration_id'])
            
            req_order = request.POST.get('order', '')
            order_val = int(req_order) if (req_order.isdigit() or (req_order.startswith('-') and req_order[1:].isdigit())) else (StaffProfile.objects.count() + 1)
            
            StaffProfile.objects.create(
                user=u,
                tier=request.POST.get('tier', 'staff'),
                designation=request.POST.get('designation', ''),
                department=request.POST.get('department', ''),
                phone=request.POST.get('phone', ''),
                linkedin_url=request.POST.get('linkedin_url', ''),
                profile_url=request.POST.get('profile_url', ''),
                scholar_url=request.POST.get('scholar_url', ''),
                order=order_val,
                is_public=('is_public' in request.POST),
            )
            if 'photo' in request.FILES:
                p = u.staff_profile
                p.photo = request.FILES['photo']
                p.save()
            messages.success(request, f"{first_name} {last_name} created.")
            cache.delete('support_committee_team_v2')
            return redirect('staff_permissions_panel')

        # ── 4. EDIT EXISTING STAFF ──
        elif action == 'edit':
            user_id = request.POST.get('user_id')
            try:
                u = User.objects.get(id=user_id)
                u.first_name = request.POST.get('first_name', u.first_name)
                u.last_name = request.POST.get('last_name', u.last_name)
                u.role = request.POST.get('role', u.role)
                if request.POST.get('password'):
                    u.set_password(request.POST['password'])
                reg_id = request.POST.get('registration_id', '').strip()
                if reg_id:
                    u.registration_id = reg_id
                u.save()
                
                p = u.staff_profile
                p.tier = request.POST.get('tier', p.tier)
                p.designation = request.POST.get('designation', p.designation)
                p.department = request.POST.get('department', p.department)
                p.phone = request.POST.get('phone', p.phone)
                p.linkedin_url = request.POST.get('linkedin_url', p.linkedin_url)
                p.profile_url = request.POST.get('profile_url', p.profile_url)
                p.scholar_url = request.POST.get('scholar_url', p.scholar_url)
                p.is_public = ('is_public' in request.POST)
                
                req_order = request.POST.get('order', '')
                if req_order.isdigit() or (req_order.startswith('-') and req_order[1:].isdigit()):
                    p.order = int(req_order)
                    
                if 'photo' in request.FILES:
                    p.photo = request.FILES['photo']
                p.save()
                messages.success(request, f"{u.get_full_name()} updated.")
            except (User.DoesNotExist, StaffProfile.DoesNotExist):
                messages.error(request, "Staff not found.")
            cache.delete('support_committee_team_v2')
            return redirect('staff_permissions_panel')

        # ── 5. UPDATE PERMISSIONS ──
        elif action == 'permissions':
            user_id = request.POST.get('user_id')
            selected_modules = list(set(request.POST.getlist('modules')))
            try:
                target_user = User.objects.get(id=user_id)
                StaffPermission.objects.filter(user=target_user).delete()
                for m in selected_modules:
                    if m in ALL_MODULE_KEYS:
                        StaffPermission.objects.create(user=target_user, module=m, granted_by=request.user)
                messages.success(request, f"Permissions updated for {target_user.get_full_name()}.")
            except User.DoesNotExist:
                messages.error(request, "User not found.")
            cache.delete('support_committee_team_v2')
            return redirect('staff_permissions_panel')

    staff_users = User.objects.filter(
        role__in=['team_head', 'staff']
    ).select_related('staff_profile').order_by('staff_profile__order', 'first_name')

    user_perms_map = {}
    for u in staff_users:
        user_perms_map[str(u.id)] = set(
            StaffPermission.objects.filter(user=u).values_list('module', flat=True)
        )

    module_categories = [
        {'name': 'Management', 'items': [('participants', 'Participants'), ('ideathon', 'Ideathon Teams'), ('meal_scanner', 'Meal Scanner'), ('checkin_scanner', 'Check-In Scanner')]},
        {'name': 'Content', 'items': [('schedule', 'Events & Schedule'), ('papers', 'Papers & Posters'), ('photos', 'Photos'), ('checkpoint', 'Checkpoint'), ('feed', 'Posts & Feed')]},
        {'name': 'Engagement', 'items': [('polls', 'Polls'), ('qa_manager', 'Q&A Manager'), ('leaderboard', 'Leaderboard'), ('chat', 'Chat'), ('reported_messages', 'Reported Messages'), ('shake_logs', 'Shake Logs'), ('chat_analytics', 'Chat Analytics')]},
        {'name': 'System', 'items': [('notifications', 'Notifications'), ('sponsors', 'Sponsors'), ('speakers', 'Speakers'), ('users_manage', 'User Management'), ('reports', 'Reports'), ('settings', 'Settings'), ('error_reports', 'Error & System Logs')]},
    ]

    context = {
        'staff_users': staff_users,
        'user_perms_map': user_perms_map,
        'module_categories': module_categories,
        'all_modules': StaffPermission.MODULE_CHOICES,
    }
    return render(request, 'panel/staff_permissions.html', context)




# ── Account Deletion Requests ──────────────────────────────────────────────

@login_required(login_url='/panel/login/')
@module_required('users_manage')
def deletion_requests(request):
    """List all pending account deletion requests."""
    from .permissions_helper import user_has_module_access
    if request.user.role not in ('super_admin', 'mgmt_admin') and not user_has_module_access(request.user, 'users_manage'):
        messages.error(request, 'Permission denied.')
        return redirect('admin_dashboard')

    pending = User.objects.filter(is_deletion_pending=True).order_by('-deletion_requested_at')
    return render(request, 'panel/deletion_requests.html', {
        'requests': pending,
        'total': pending.count(),
    })


@login_required(login_url='/panel/login/')
@module_required('users_manage')
def deletion_request_action(request, pk):
    """Approve (execute soft-delete) or deny a pending deletion request."""
    from .permissions_helper import user_has_module_access
    if request.user.role not in ('super_admin', 'mgmt_admin') and not user_has_module_access(request.user, 'users_manage'):
        messages.error(request, 'Permission denied.')
        return redirect('admin_dashboard')

    user_target = get_object_or_404(User, pk=pk, is_deletion_pending=True)

    if request.method == 'POST':
        action = request.POST.get('action', '')

        if action == 'approve':
            # Execute soft-delete (same logic as original delete_account_view)
            user_target.is_active = False
            user_target.suspended_reason = 'Account deleted per user request (admin approved).'
            user_target.first_name = 'Deleted'
            user_target.last_name = 'User'
            user_target.phone = ''
            user_target.bio = ''
            user_target.linkedin_url = ''
            user_target.research_interests = ''
            user_target.profile_photo = None
            user_target.is_deletion_pending = False
            user_target.set_unusable_password()
            user_target.save()

            # Clear push / FCM tokens
            try:
                from apps.notifications.models import DeviceToken
                DeviceToken.objects.filter(user=user_target).delete()
            except Exception:
                pass
            try:
                from .models import UserFCMToken
                UserFCMToken.objects.filter(user=user_target).delete()
            except Exception:
                pass

            messages.success(request, 'Account deletion approved and executed. User data has been anonymized.')

        elif action == 'deny':
            user_target.is_deletion_pending = False
            user_target.deletion_requested_at = None
            user_target.save(update_fields=['is_deletion_pending', 'deletion_requested_at'])
            messages.success(request, f'Deletion request denied for {user_target.get_full_name()}. User can continue using their account.')

    return redirect('deletion_requests')


@login_required(login_url='/panel/login/')
@module_required('users_manage')
def deletion_history(request):
    """Show all approved & executed account deletions."""
    from .permissions_helper import user_has_module_access
    if request.user.role not in ('super_admin', 'mgmt_admin') and not user_has_module_access(request.user, 'users_manage'):
        messages.error(request, 'Permission denied.')
        return redirect('admin_dashboard')

    history = User.objects.filter(
        first_name='Deleted',
        last_name='User',
        is_active=False,
    ).exclude(
        deletion_requested_at__isnull=True
    ).order_by('-deletion_requested_at')

    return render(request, 'panel/deletion_history.html', {
        'history': history,
        'total': history.count(),
    })
