import csv
import io
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
    'Mobile Number', 'Address', 'PIN / Postal Code',
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
}


def _generate_temp_password(length=12):
    alphabet = string.ascii_letters + string.digits
    while True:
        pwd = ''.join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.isupper() for c in pwd)
                and any(c.islower() for c in pwd)
                and any(c.isdigit() for c in pwd)):
            return pwd


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


def _send_credentials_email(email, full_name, temp_password):
    subject = "ETD 2026 — Your Login Credentials"
    body = f"""Dear {full_name},

Welcome to ETD 2026!

Your account has been created. Use the details below to log in:

  Email:    {email}
  Password: {temp_password}

Login at: https://etd2026.iitd.ac.in

IMPORTANT: You will be asked to change your password on first login.

If you did not expect this email, please contact the organising team.

Regards,
ETD 2026 Organising Committee
IIT Delhi
"""
    try:
        send_mail(subject, body, None, [email], fail_silently=False)
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
        email    = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')
        user     = authenticate(request, username=email, password=password)

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
    return redirect('admin_login')


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
def participants_upload(request):
    if request.method == 'POST':
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

        objs = [ParticipantImport(uploaded_by=request.user, **row) for row in rows]
        ParticipantImport.objects.bulk_create(objs, ignore_conflicts=False)

        if errors:
            messages.warning(request, f"{len(errors)} row(s) skipped: " + " | ".join(errors))

        messages.success(request, f"{len(rows)} row(s) staged for review.")
        return redirect('participants_preview')

    return render(request, 'panel/participants_upload.html')


@login_required(login_url='/panel/login/')
def participants_preview(request):
    pending = ParticipantImport.objects.filter(
        uploaded_by=request.user, status='pending'
    ).order_by('id')

    existing_emails = set(
        User.objects.filter(
            email__in=[p.email for p in pending]
        ).values_list('email', flat=True)
    )

    existing_reg_ids = set(
        User.objects.filter(
            registration_id__in=[p.registration_id for p in pending if p.registration_id]
        ).values_list('registration_id', flat=True)
    )

    rows_display = []
    for p in pending:
        dup_reason = ''
        if p.email in existing_emails:
            dup_reason = 'Email exists'
        elif p.registration_id and p.registration_id in existing_reg_ids:
            dup_reason = 'Reg ID exists'
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
def participants_delete_row(request, pk):
    if request.method == 'POST':
        ParticipantImport.objects.filter(
            pk=pk, uploaded_by=request.user, status='pending'
        ).delete()
    return redirect('participants_preview')


@login_required(login_url='/panel/login/')
def participants_confirm(request):
    if request.method != 'POST':
        return redirect('participants_preview')

    pending = ParticipantImport.objects.filter(
        uploaded_by=request.user, status='pending'
    )

    if not pending.exists():
        messages.error(request, 'Nothing to import.')
        return redirect('participants_upload')

    send_email = request.POST.get('send_email') == 'on'

    created_count = 0
    skipped_count = 0
    email_failed  = 0

    for staged in pending:
        if User.objects.filter(email=staged.email).exists():
            staged.status     = 'failed'
            staged.error_note = 'Email already registered.'
            staged.save(update_fields=['status', 'error_note'])
            skipped_count += 1
            continue

        if staged.registration_id and User.objects.filter(registration_id=staged.registration_id).exists():
            staged.status     = 'failed'
            staged.error_note = 'Registration ID already exists.'
            staged.save(update_fields=['status', 'error_note'])
            skipped_count += 1
            continue

        first_name, last_name = _split_name(staged.full_name)
        manual_pwd = request.POST.get('temp_password', '').strip()
        temp_password = manual_pwd if manual_pwd else _generate_temp_password()

        try:
            with transaction.atomic():
                User.objects.create_user(
                    email           = staged.email,
                    password        = temp_password,
                    first_name      = first_name,
                    last_name       = last_name,
                    phone           = staged.mobile,
                    affiliation     = staged.organisation,
                    designation     = staged.designation,
                    gender          = staged.gender,
                    registration_id = staged.registration_id or None,
                    role            = 'participant',
                    must_change_password = True,
                    is_active       = True,
                )
                staged.status = 'imported'
                staged.save(update_fields=['status'])

            if HAS_LEADERBOARD:
                try:
                    award_points(User.objects.get(email=staged.email), PointAction.SIGNUP, 'Welcome to ETD 2026')
                except Exception:
                    pass

            if send_email:
                ok = _send_credentials_email(staged.email, staged.full_name, temp_password)
                if not ok:
                    email_failed += 1

            created_count += 1

        except Exception as exc:
            logger.exception("Failed to create user for %s", staged.email)
            staged.status     = 'failed'
            staged.error_note = str(exc)[:400]
            staged.save(update_fields=['status', 'error_note'])
            skipped_count += 1

    msg = f"Import done: {created_count} created, {skipped_count} skipped."
    if send_email and email_failed:
        msg += f" ⚠ {email_failed} credential email(s) failed."
    elif not send_email:
        msg += " (Emails not sent)"
    messages.success(request, msg)
    return redirect('participants_list')


@login_required(login_url='/panel/login/')
def participants_list(request):
    from apps.checkins.models import CheckIn
    search = request.GET.get('search', '').strip()
    status_filter = request.GET.get('status', '').strip()

    qs = User.objects.filter(role='participant').order_by('first_name', 'last_name')
    if search:
        qs = qs.filter(
            Q(first_name__icontains=search) | Q(last_name__icontains=search) |
            Q(email__icontains=search) | Q(registration_id__icontains=search)
        )

    # Fetch all checked-in participant IDs
    checked_in_ids = set(
        CheckIn.objects.filter(checkin_type='conference').values_list('user_id', flat=True)
    )

    total_all = User.objects.filter(role='participant').count()
    all_participant_ids = set(User.objects.filter(role='participant').values_list('id', flat=True))
    total_checked_in = len(checked_in_ids.intersection(all_participant_ids))
    total_not_checked_in = total_all - total_checked_in
    password_set = User.objects.filter(role='participant', must_change_password=False).count()

    participants = list(qs)
    for p in participants:
        p.is_checked_in = p.id in checked_in_ids

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
        'showing': len(participants),
    })


@login_required(login_url='/panel/login/')
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
        temp_password = _generate_temp_password()
        reg_id = _next_single_reg_id()

        try:
            User.objects.create_user(
                email           = email,
                password        = temp_password,
                first_name      = first_name,
                last_name       = last_name,
                phone           = request.POST.get('mobile', '').strip(),
                affiliation     = request.POST.get('organisation', '').strip(),
                designation     = request.POST.get('designation', '').strip(),
                gender          = request.POST.get('gender', '').strip(),
                registration_id = reg_id,
                role            = 'participant',
                must_change_password = True,
                is_active       = True,
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
            ok = _send_credentials_email(email, full_name, temp_password)
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
def participant_delete(request, pk):
    user = get_object_or_404(User, pk=pk, role='participant')

    if request.method == 'POST':
        name = user.get_full_name()
        user.delete()
        messages.success(request, f'Deleted {name}.')

    return redirect('participants_list')


# ── CSV template download ──────────────────────────────────────────────────

def participants_template(request):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="etd2026_participants_template.csv"'

    writer = csv.writer(response)
    writer.writerow(_CSV_HEADERS)
    writer.writerow(['Dr.', 'Amit Kumar', 'ETD-2026-R-001', 'amit.kumar@example.com', 'Male',
                     'Associate Professor', 'IIT Delhi', '9876543210',
                     '123 Main Street, New Delhi', '110016'])
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
            return redirect('admin_login')

    return render(request, 'panel/password_reset_confirm.html', {
        'valid_link': valid,
        'uidb64': uidb64,
        'token': token,
    })


# ── user management (warn / suspend / unsuspend) ──────────────────────────

@login_required(login_url='/panel/login/')
def users_manage(request):
    search = request.GET.get('search', '').strip()
    role   = request.GET.get('role', '').strip()

    qs = User.objects.all().order_by('role', 'first_name', 'last_name')
    if search:
        qs = qs.filter(
            Q(first_name__icontains=search) | Q(last_name__icontains=search) |
            Q(email__icontains=search) | Q(registration_id__icontains=search)
        )
    if role:
        qs = qs.filter(role=role)

    roles = User.Role.choices

    return render(request, 'panel/users_manage.html', {
        'users': qs,
        'total': qs.count(),
        'suspended_count': qs.filter(is_active=False).count(),
        'warned_count': qs.exclude(warning_note='').count(),
        'search': search,
        'role_filter': role,
        'roles': roles,
    })


@login_required(login_url='/panel/login/')
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
                title='\u26a0\ufe0f Warning from Admin',
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
def user_unsuspend(request, pk):
    user_target = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        user_target.is_active = True
        user_target.suspended_reason = ''
        user_target.save(update_fields=['is_active', 'suspended_reason'])
        messages.success(request, f'{user_target.get_full_name()} has been restored.')
    return redirect('users_manage')


@login_required(login_url='/panel/login/')
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

    if request.method == 'POST':
        action = request.POST.get('action', '')

        if action == 'delete':
            user_id = request.POST.get('user_id')
            try:
                u = User.objects.get(id=user_id)
                name = u.get_full_name()
                u.delete()
                messages.success(request, f"{name} deleted.")
            except User.DoesNotExist:
                messages.error(request, "User not found.")
            return redirect('staff_permissions_panel')

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
            StaffProfile.objects.create(
                user=u,
                tier=request.POST.get('tier', 'staff'),
                designation=request.POST.get('designation', ''),
                department=request.POST.get('department', ''),
                phone=request.POST.get('phone', ''),
                linkedin_url=request.POST.get('linkedin_url', ''),
                profile_url=request.POST.get('profile_url', ''),
                scholar_url=request.POST.get('scholar_url', ''),
                order=StaffProfile.objects.count() + 1,
            )
            if 'photo' in request.FILES:
                p = u.staff_profile
                p.photo = request.FILES['photo']
                p.save()
            messages.success(request, f"{first_name} {last_name} created.")
            return redirect('staff_permissions_panel')

        elif action == 'edit':
            user_id = request.POST.get('user_id')
            try:
                u = User.objects.get(id=user_id)
                u.first_name = request.POST.get('first_name', u.first_name)
                u.last_name = request.POST.get('last_name', u.last_name)
                u.role = request.POST.get('role', u.role)
                if request.POST.get('password'):
                    u.set_password(request.POST['password'])
                u.save()
                p = u.staff_profile
                p.tier = request.POST.get('tier', p.tier)
                p.designation = request.POST.get('designation', p.designation)
                p.department = request.POST.get('department', p.department)
                p.phone = request.POST.get('phone', p.phone)
                p.linkedin_url = request.POST.get('linkedin_url', p.linkedin_url)
                p.profile_url = request.POST.get('profile_url', p.profile_url)
                p.scholar_url = request.POST.get('scholar_url', p.scholar_url)
                if 'photo' in request.FILES:
                    p.photo = request.FILES['photo']
                p.save()
                messages.success(request, f"{u.get_full_name()} updated.")
            except (User.DoesNotExist, StaffProfile.DoesNotExist):
                messages.error(request, "Staff not found.")
            return redirect('staff_permissions_panel')

        elif action == 'permissions':
            user_id = request.POST.get('user_id')
            selected_modules = request.POST.getlist('modules')
            try:
                target_user = User.objects.get(id=user_id)
                StaffPermission.objects.filter(user=target_user).delete()
                for m in selected_modules:
                    if m in ALL_MODULE_KEYS:
                        StaffPermission.objects.create(user=target_user, module=m, granted_by=request.user)
                messages.success(request, f"Permissions updated for {target_user.get_full_name()}.")
            except User.DoesNotExist:
                messages.error(request, "User not found.")
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
        {'name': 'Content', 'items': [('schedule', 'Events & Schedule'), ('papers', 'Papers & Posters'), ('papers', 'Papers & Posters'), ('photos', 'Photos'), ('checkpoint', 'Checkpoint'), ('feed', 'Posts & Feed')]},
        {'name': 'Engagement', 'items': [('polls', 'Polls'), ('qa_manager', 'Q&A Manager'), ('leaderboard', 'Leaderboard'), ('chat', 'Chat'), ('reported_messages', 'Reported Messages'), ('shake_logs', 'Shake Logs'), ('chat_analytics', 'Chat Analytics')]},
        {'name': 'System', 'items': [('notifications', 'Notifications'), ('sponsors', 'Sponsors'), ('speakers', 'Speakers'), ('users_manage', 'User Management'), ('reports', 'Reports'), ('settings', 'Settings')]},
    ]

    context = {
        'staff_users': staff_users,
        'user_perms_map': user_perms_map,
        'module_categories': module_categories,
        'all_modules': StaffPermission.MODULE_CHOICES,
    }
    return render(request, 'panel/staff_permissions.html', context)

