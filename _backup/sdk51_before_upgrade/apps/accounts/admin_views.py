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

# Expected CSV headers (case-insensitive match)
_CSV_HEADERS = [
    'Salutation', 'Full Name', 'Email ID', 'Gender',
    'Designation', 'Organisation / Institute',
    'Mobile Number', 'Address', 'PIN / Postal Code',
]

_HEADER_MAP = {
    # normalised lowercase → model field
    'salutation':               'salutation',
    'full name':                'full_name',
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
    """Temp password: letters + digits, always has upper + lower + digit."""
    alphabet = string.ascii_letters + string.digits
    while True:
        pwd = ''.join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.isupper() for c in pwd)
                and any(c.islower() for c in pwd)
                and any(c.isdigit() for c in pwd)):
            return pwd


def _split_name(full_name):
    """Split 'First Last' → (first, last). If single word, last=''."""
    parts = full_name.strip().split(None, 1)
    return (parts[0], parts[1]) if len(parts) == 2 else (parts[0] if parts else '', '')


def _parse_csv_bytes(raw_bytes):
    """
    Parse CSV/Excel bytes into list of dicts.
    Returns (rows, errors) where rows are clean dicts and errors are strings.
    Supports .csv and basic .xlsx via openpyxl if installed; falls back to csv.
    """
    rows, errors = [], []

    # Try Excel first
    if _looks_like_excel(raw_bytes):
        return _parse_excel(raw_bytes)

    # CSV path
    try:
        text = raw_bytes.decode('utf-8-sig')  # handles BOM
    except UnicodeDecodeError:
        text = raw_bytes.decode('latin-1')

    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames:
        return [], ['File appears empty or has no header row.']

    # Build column mapping from actual headers
    col_map = {}
    for h in reader.fieldnames:
        key = h.strip().lower()
        if key in _HEADER_MAP:
            col_map[h] = _HEADER_MAP[key]

    if 'email' not in col_map.values() and 'Email ID' not in (col_map.values()):
        # re-check
        pass
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
    # XLSX magic bytes: PK\x03\x04
    return raw_bytes[:4] == b'PK\x03\x04'


def _parse_excel(raw_bytes):
    """Parse .xlsx — requires openpyxl (already pulled in by Django/Pillow chain usually)."""
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

    col_map = {}  # index → field name
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
    """Send welcome + credentials email. Returns True on success."""
    subject = "ETD 2026 — Your Login Credentials"
    body = f"""
Dear {full_name},

Welcome to ETD 2026!

Your account has been created. Use the details below to log in:

  Email:    {email}
  Password: {temp_password}

Login at: https://etd2026.iitd.ac.in  (update this URL once live)

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
    if request.user.is_authenticated:
        return redirect('admin_dashboard')

    if request.method == 'POST':
        email    = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')
        user     = authenticate(request, username=email, password=password)

        if user is not None and user.role in ('super_admin', 'mgmt_admin'):
            login(request, user)
            return redirect('admin_dashboard')
        elif user is not None:
            messages.error(request, 'You do not have admin access.')
        else:
            messages.error(request, 'Invalid email or password.')

    return render(request, 'panel/login.html')


@login_required(login_url='/panel/login/')
def admin_logout(request):
    logout(request)
    return redirect('admin_login')


# ── dashboard ──────────────────────────────────────────────────────────────

@login_required(login_url='/panel/login/')
def admin_dashboard(request):
    total = User.objects.filter(role='participant').count()
    context = {
        'total_participants': total or 480,   # falls back to mock until data exists
        'checked_in': 312,
        'checkin_percent': 65,
        'photos_uploaded': 847,
        'photos_pending': 34,
        'active_polls': 12,
        'profile_complete_percent': 58,
        'today_events': [
            {'time': '09:00', 'title': 'Opening Ceremony',       'room': 'Hall A',    'status': 'live'},
            {'time': '10:30', 'title': 'Keynote: AI in Research', 'room': 'Hall A',    'status': 'upcoming'},
            {'time': '13:00', 'title': 'Lunch Break',             'room': 'Cafeteria', 'status': 'upcoming'},
            {'time': '14:30', 'title': 'Workshop: Data Science',  'room': 'Room 201',  'status': 'upcoming'},
        ],
        'recent_checkins': [
            {'name': 'Rahul Sharma', 'time': '2 min ago',  'id': 'CONF-0042'},
            {'name': 'Priya Patel',  'time': '5 min ago',  'id': 'CONF-0108'},
            {'name': 'Amit Kumar',   'time': '8 min ago',  'id': 'CONF-0156'},
            {'name': 'Sneha Gupta',  'time': '12 min ago', 'id': 'CONF-0201'},
        ],
    }
    return render(request, 'panel/dashboard.html', context)


# ── participant import ─────────────────────────────────────────────────────

@login_required(login_url='/panel/login/')
def participants_upload(request):
    """Step 1: show upload form or handle file POST."""
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

        # Wipe any previous pending rows uploaded by this admin
        ParticipantImport.objects.filter(
            uploaded_by=request.user, status='pending'
        ).delete()

        # Bulk-stage valid rows
        objs = [
            ParticipantImport(
                uploaded_by=request.user,
                **row,
            )
            for row in rows
        ]
        ParticipantImport.objects.bulk_create(objs, ignore_conflicts=False)

        if errors:
            messages.warning(request, f"{len(errors)} row(s) skipped: " + " | ".join(errors))

        messages.success(request, f"{len(rows)} row(s) staged for review.")
        return redirect('participants_preview')

    return render(request, 'panel/participants_upload.html')


@login_required(login_url='/panel/login/')
def participants_preview(request):
    """Step 2: show staged rows, let admin delete bad ones, then confirm."""
    pending = ParticipantImport.objects.filter(
        uploaded_by=request.user, status='pending'
    ).order_by('id')

    # Check which emails already exist as users
    existing_emails = set(
        User.objects.filter(
            email__in=[p.email for p in pending]
        ).values_list('email', flat=True)
    )

    rows_display = []
    for p in pending:
        rows_display.append({
            'obj': p,
            'duplicate': p.email in existing_emails,
        })

    return render(request, 'panel/participants_preview.html', {
        'rows': rows_display,
        'total': pending.count(),
        'duplicates': len(existing_emails),
    })


@login_required(login_url='/panel/login/')
def participants_delete_row(request, pk):
    """Delete a single staged row before confirming."""
    if request.method == 'POST':
        ParticipantImport.objects.filter(
            pk=pk, uploaded_by=request.user, status='pending'
        ).delete()
    return redirect('participants_preview')


@login_required(login_url='/panel/login/')
def participants_confirm(request):
    """Step 3: create User records + send emails for all pending rows."""
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
    email_failed  = 0

    for staged in pending:
        # Skip duplicates
        if User.objects.filter(email=staged.email).exists():
            staged.status     = 'failed'
            staged.error_note = 'Email already registered.'
            staged.save(update_fields=['status', 'error_note'])
            skipped_count += 1
            continue

        first_name, last_name = _split_name(staged.full_name)
        temp_password = _generate_temp_password()

        try:
            with transaction.atomic():
                User.objects.create_user(
                    email        = staged.email,
                    password     = temp_password,
                    first_name   = first_name,
                    last_name    = last_name,
                    phone        = staged.mobile,
                    affiliation  = staged.organisation,
                    role         = 'participant',
                    must_change_password = True,
                    is_active    = True,
                )
                staged.status = 'imported'
                staged.save(update_fields=['status'])

            # Award signup points
            if HAS_LEADERBOARD:
                try:
                    award_points(User.objects.get(email=staged.email), PointAction.SIGNUP, 'Welcome to ETD 2026')
                except Exception:
                    pass  # non-critical

            # Send outside transaction so a failed email doesn't rollback the user
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

    # Summary message
    msg = f"Import done: {created_count} created, {skipped_count} skipped."
    if email_failed:
        msg += f" ⚠ {email_failed} credential email(s) failed — check server logs."
    messages.success(request, msg)
    return redirect('participants_list')


@login_required(login_url='/panel/login/')
def participants_list(request):
    """Show all participant users with basic info."""
    participants = User.objects.filter(role='participant').order_by('first_name', 'last_name')
    total = participants.count()
    password_set = participants.filter(must_change_password=False).count()
    return render(request, 'panel/participants_list.html', {
        'participants': participants,
        'total': total,
        'password_set': password_set,
        'password_pending': total - password_set,
    })




@login_required(login_url='/panel/login/')
def participant_edit(request, pk):
    """Edit a single participant."""
    user = get_object_or_404(User, pk=pk, role='participant')

    if request.method == 'POST':
        user.first_name  = request.POST.get('first_name', user.first_name).strip()
        user.last_name   = request.POST.get('last_name', user.last_name).strip()
        user.email       = request.POST.get('email', user.email).strip().lower()
        user.phone       = request.POST.get('phone', user.phone).strip()
        user.affiliation = request.POST.get('affiliation', user.affiliation).strip()

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
    """Delete a single participant."""
    user = get_object_or_404(User, pk=pk, role='participant')

    if request.method == 'POST':
        name = user.get_full_name()
        user.delete()
        messages.success(request, f'Deleted {name}.')

    return redirect('participants_list')


# ── CSV template download ──────────────────────────────────────────────────

def participants_template(request):
    """Return a ready-to-fill CSV template."""
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="etd2026_participants_template.csv"'

    writer = csv.writer(response)
    writer.writerow(_CSV_HEADERS)
    # One example row so the format is obvious
    writer.writerow(['Dr.', 'Amit Kumar', 'amit.kumar@example.com', 'Male',
                     'Associate Professor', 'IIT Delhi', '9876543210',
                     '123 Main Street, New Delhi', '110016'])
    return response


# ── forgot password ────────────────────────────────────────────────────────
# Uses Django's built-in token generator — no new model needed.

from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str


def password_reset_request(request):
    """Public page: enter email → receive reset link."""
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
            pass  # silent — don't reveal whether email exists

        # Always show the same message (prevents email enumeration)
        messages.success(
            request,
            'If that email is registered, a reset link has been sent.'
        )
        return redirect('password_reset_request')

    return render(request, 'panel/password_reset_request.html')


def password_reset_confirm(request, uidb64, token):
    """Public page: set new password via token link."""
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
    """List ALL users (not just participants) with status indicators."""
    from django.db.models import Q

    search = request.GET.get('search', '').strip()
    role   = request.GET.get('role', '').strip()

    qs = User.objects.all().order_by('role', 'first_name', 'last_name')
    if search:
        qs = qs.filter(
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search)  |
            Q(email__icontains=search)      |
            Q(registration_id__icontains=search)
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
    """Warn a user — POST with note."""
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
        user_target.save(update_fields=['warning_note'])

        # Send push notification
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
    """Suspend a user — POST with reason."""
    user_target = get_object_or_404(User, pk=pk)
    if user_target.role in ('super_admin', 'mgmt_admin'):
        messages.error(request, 'Cannot suspend admin accounts.')
        return redirect('users_manage')

    if request.method == 'POST':
        reason = request.POST.get('reason', '').strip() or 'Account suspended by admin.'
        user_target.is_active = False
        user_target.suspended_reason = reason
        user_target.save(update_fields=['is_active', 'suspended_reason'])

        # Deactivate device tokens
        try:
            from apps.notifications.models import DeviceToken
            DeviceToken.objects.filter(user=user_target).update(is_active=False)
        except Exception:
            pass

        # Send email
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
    """Restore a suspended user."""
    user_target = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        user_target.is_active = True
        user_target.suspended_reason = ''
        user_target.save(update_fields=['is_active', 'suspended_reason'])
        messages.success(request, f'{user_target.get_full_name()} has been restored.')
    return redirect('users_manage')


@login_required(login_url='/panel/login/')
def user_clear_warning(request, pk):
    """Clear warning note from a user."""
    user_target = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        user_target.warning_note = ''
        user_target.save(update_fields=['warning_note'])
        messages.success(request, f'Warning cleared for {user_target.get_full_name()}.')
    return redirect('users_manage')


# ── admin_required decorator ───────────────────────────────────────────────

from functools import wraps

def admin_required(view_func):
    """Allow only authenticated super_admin or mgmt_admin users."""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('/panel/login/')
        if request.user.role not in ('super_admin', 'mgmt_admin'):
            messages.error(request, 'You do not have permission to access this page.')
            return redirect('admin_dashboard')
        return view_func(request, *args, **kwargs)
    return wrapper
