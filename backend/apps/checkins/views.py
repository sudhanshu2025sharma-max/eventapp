import datetime
import qrcode
import io
from zoneinfo import ZoneInfo
from django.utils import timezone
from django.db import models
from django.core.mail import EmailMessage
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import User
from apps.checkins.models import CheckIn, MealPass, MealWindow
from apps.checkins.meal_utils import sync_meal_window, deduce_meal_name
from apps.checkins.push import push_to_checked_in
from apps.leaderboard.utils import award_points

IST = ZoneInfo("Asia/Kolkata")

def _user_detail(user, request=None):
    if not user:
        return {
            "id": None, "name": "Guest Attendee", "first_name": "Guest", "last_name": "",
            "email": "", "registration_id": "GUEST", "affiliation": "",
            "designation": "", "role": "attendee", "research_interests": "",
            "photo": None, "profile_photo_url": None,
        }
    photo_url = None
    if getattr(user, 'profile_photo', None):
        try:
            photo_url = request.build_absolute_uri(user.profile_photo.url) if request else user.profile_photo.url
        except Exception:
            photo_url = user.profile_photo.url

    raw_ri = getattr(user, 'research_interests', '') or ''
    if isinstance(raw_ri, list):
        raw_ri = ', '.join(str(x) for x in raw_ri if x)

    return {
        "id": str(user.id),
        "name": user.get_full_name() or user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "registration_id": getattr(user, 'registration_id', '') or '',
        "affiliation": getattr(user, 'affiliation', '') or '',
        "designation": getattr(user, 'designation', '') or '',
        "role": getattr(user, 'role', 'participant'),
        "research_interests": raw_ri,
        "photo": photo_url,
        "profile_photo_url": photo_url,
    }

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_qr(request):
    user = request.user
    reg_id = getattr(user, 'registration_id', None) or str(user.id)
    return Response({
        "success": True,
        "registration_id": reg_id,
        "email": user.email,
        "qr_data": reg_id,
        "user": _user_detail(user, request)
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def meal_status(request):
    try:
        sync_meal_window()
    except Exception:
        pass

    user = request.user
    today = timezone.now().astimezone(IST).date()

    window = MealWindow.objects.filter(date=today).order_by('-id').first()
    is_open = window.is_open if window else False
    active_meal_name = window.meal_type if (window and window.meal_type) else "Meal"

    scanned_count = MealPass.objects.filter(date=today, meal_type=active_meal_name, used=True).count()

    active_pass = MealPass.objects.filter(user=user, date=today, meal_type=active_meal_name, used=True).first() if window else None
    
    pass_data = None
    if active_pass:
        pass_data = {
            "id": str(active_pass.id),
            "meal_type": active_pass.meal_type,
            "used": True,
            "used_at": active_pass.used_at.isoformat() if active_pass.used_at else None,
            "date": str(active_pass.date),
        }

    return Response({
        "success": True,
        "is_open": is_open,
        "meal_open": is_open,
        "meal_type": active_meal_name,
        "meal_name": active_meal_name,
        "has_pass": bool(pass_data),
        "pass": pass_data,
        "meal_pass": pass_data,
        "scanned_count": scanned_count,
        "meal_window": {
            "is_open": is_open,
            "meal_type": active_meal_name,
            "start_time": window.start_time.strftime("%I:%M %p") if window and window.start_time else "12:00 PM",
            "end_time": window.end_time.strftime("%I:%M %p") if window and window.end_time else "02:00 PM",
            "scanned_count": scanned_count,
        } if window else None
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_meal_pass(request):
    user = request.user
    now_ist = timezone.now().astimezone(IST)
    today = now_ist.date()

    is_checked_in = CheckIn.objects.filter(user=user, checkin_type='conference').exists()
    if not is_checked_in:
        return Response({
            "success": False,
            "error": "You must check in at the registration desk before generating a meal pass."
        }, status=400)

    try:
        sync_meal_window()
    except Exception:
        pass

    window = MealWindow.objects.filter(date=today).order_by('-id').first()
    if not window or not window.is_open:
        return Response({
            "success": False,
            "error": "No active dining service window is currently open."
        }, status=400)

    active_meal_name = window.meal_type or "Meal"

    existing_pass = MealPass.objects.filter(user=user, date=today, meal_type=active_meal_name, is_active=True).first()
    if existing_pass:
        return Response({
            "success": True,
            "status": "already_exists",
            "message": f"Your {active_meal_name} pass has already been generated.",
            "pass": {
                "id": str(existing_pass.id),
                "qr_data": str(existing_pass.id),
                "meal_type": existing_pass.meal_type,
                "used": existing_pass.used,
                "date": str(existing_pass.date),
            }
        }, status=200)

    new_pass = MealPass.objects.create(
        user=user,
        date=today,
        meal_type=active_meal_name,
        is_active=True,
        used=False,
    )

    return Response({
        "success": True,
        "status": "success",
        "message": f"{active_meal_name} pass generated successfully!",
        "pass": {
            "id": str(new_pass.id),
            "qr_data": str(new_pass.id),
            "meal_type": new_pass.meal_type,
            "used": False,
            "date": str(new_pass.date),
        }
    }, status=201)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def scan_meal(request):
    raw_qr = request.data.get('qr_data') or request.data.get('qr_code') or request.data.get('registration_id') or ''
    raw_qr = str(raw_qr).strip()

    target_user = User.objects.filter(models.Q(registration_id__iexact=raw_qr) | models.Q(email__iexact=raw_qr)).first()
    
    if not target_user:
        try:
            import uuid
            pass_uuid = uuid.UUID(raw_qr)
            fallback_pass = MealPass.objects.filter(id=pass_uuid).first()
            if fallback_pass and fallback_pass.user:
                target_user = fallback_pass.user
        except Exception:
            pass

    if not target_user:
        return Response({"success": False, "error": f"Participant '{raw_qr}' not found."}, status=404)

    is_checked_in = CheckIn.objects.filter(user=target_user, checkin_type='conference').exists()
    if not is_checked_in:
        return Response({
            "success": False, 
            "error": f"Not Checked-In! {target_user.get_full_name()} must check in at registration desk first."
        }, status=400)

    today = timezone.now().astimezone(IST).date()
    window = MealWindow.objects.filter(date=today).order_by('-id').first()
    if not window or not window.is_open:
        return Response({"success": False, "error": "No active dining service is currently open."}, status=400)

    active_meal_name = window.meal_type or "Meal"

    existing_scan = MealPass.objects.filter(user=target_user, date=today, meal_type=active_meal_name, used=True).first()
    if existing_scan:
        time_str = existing_scan.used_at.astimezone(IST).strftime('%I:%M %p') if existing_scan.used_at else ""
        return Response({
            "success": False,
            "error": f"Already Redeemed at {time_str}",
            "message": f"{target_user.get_full_name()} already redeemed {active_meal_name} at {time_str}."
        }, status=400)

    meal_pass = MealPass.objects.filter(user=target_user, date=today, meal_type=active_meal_name, used=False).first()
    if not meal_pass:
        meal_pass = MealPass(user=target_user, date=today, meal_type=active_meal_name, is_active=True)
    
    meal_pass.used = True
    meal_pass.used_at = timezone.now()
    meal_pass.scanned_by = request.user
    meal_pass.save()

    try:
        award_points(target_user, 'meal_checkin', f"Attended {meal_pass.meal_type} service")
    except Exception:
        pass

    return Response({
        "success": True,
        "status": "success",
        "message": f"✅ {active_meal_name} approved for {target_user.get_full_name()}!"
    }, status=200)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_meal_scan(request):
    pass_id = request.data.get('pass_id')
    meal_pass = MealPass.objects.filter(id=pass_id).first()
    if not meal_pass:
        return Response({"success": False, "error": "Record not found"}, status=404)
    
    user_name = meal_pass.display_name
    meal_type = meal_pass.meal_type
    meal_pass.delete()
    return Response({"success": True, "message": f"Reset {meal_type} scan for {user_name}."})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_meal_scan(request):
    pass_id = request.data.get('pass_id')
    meal_pass = MealPass.objects.filter(id=pass_id).first()
    if not meal_pass:
        return Response({"success": False, "error": "Record not found"}, status=404)
    
    meal_pass.delete()
    return Response({"success": True, "message": "Meal scan reset successfully. User can scan again."})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def scan_checkin(request):
    raw_code = request.data.get('registration_id') or request.data.get('qr_data') or request.data.get('qr_code') or ''
    raw_code = str(raw_code).strip()
    target_user = User.objects.filter(models.Q(registration_id__iexact=raw_code) | models.Q(email__iexact=raw_code)).first()
    if not target_user:
        return Response({"success": False, "error": f"Participant '{raw_code}' not found."}, status=404)

    checkin, created = CheckIn.objects.get_or_create(
        user=target_user,
        checkin_type='conference',
        defaults={'scanned_by': request.user, 'goodies_status': 'pending'}
    )
    
    # Award points on first check-in
    if created:
        try:
            award_points(target_user, 'checkin', 'Conference check-in bonus')
        except Exception:
            pass

    return Response({
        "success": True,
        "status": "success",
        "created": created,
        "message": f"{target_user.get_full_name()} checked in successfully!",
        "user": _user_detail(target_user, request),
        "goodies_status": getattr(checkin, 'goodies_status', 'pending'),
        "scanned_at": checkin.scanned_at.isoformat() if checkin.scanned_at else None,
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_goodies(request):
    raw_code = request.data.get('registration_id') or request.data.get('qr_data') or request.data.get('user_id') or ''
    action = request.data.get('action', 'received') # 'received' or 'skipped'
    note = request.data.get('note', '').strip()
    
    raw_code = str(raw_code).strip()
    target_user = User.objects.filter(
        models.Q(registration_id__iexact=raw_code) | 
        models.Q(email__iexact=raw_code) |
        models.Q(id=raw_code if len(raw_code)==36 else None)
    ).first()

    if not target_user:
        return Response({"success": False, "error": "Participant not found."}, status=404)

    checkin, _ = CheckIn.objects.get_or_create(
        user=target_user, 
        checkin_type='conference',
        defaults={'scanned_by': request.user, 'goodies_status': action, 'goodies_note': note, 'goodies_confirmed_by': request.user, 'goodies_confirmed_at': timezone.now()}
    )
    
    checkin.goodies_status = action
    if note:
        checkin.goodies_note = note
    checkin.goodies_confirmed_by = request.user
    checkin.goodies_confirmed_at = timezone.now()
    checkin.save(update_fields=['goodies_status', 'goodies_note', 'goodies_confirmed_by', 'goodies_confirmed_at'])

    msg = f"Conference kit issued to {target_user.get_full_name()}!" if action == 'received' else f"Kit skipped for {target_user.get_full_name()}. Note saved."

    return Response({
        "success": True, 
        "status": "success", 
        "message": msg,
        "goodies_status": action,
        "goodies_note": checkin.goodies_note,
        "user": _user_detail(target_user, request)
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def checkin_status(request):
    is_staff_user = getattr(request.user, 'role', '') in ['super_admin', 'mgmt_admin', 'team_head', 'staff']
    c = CheckIn.objects.filter(user=request.user, checkin_type='conference').first()
    checked_in = is_staff_user or (c is not None)
    
    goodies_status = getattr(c, 'goodies_status', 'pending') if c else 'pending'
    scanned_at = c.scanned_at.isoformat() if (c and c.scanned_at) else None

    return Response({
        "success": True,
        "checked_in": checked_in,
        "is_checked_in": checked_in,
        "goodies_status": goodies_status,
        "scanned_at": scanned_at,
        "user": _user_detail(request.user, request)
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def checkin_list(request):
    checkins = CheckIn.objects.select_related('user', 'scanned_by').order_by('-scanned_at')[:100]
    return Response({
        "success": True,
        "checkins": [{
            "id": str(c.id),
            "user": _user_detail(c.user, request),
            "goodies_status": getattr(c, 'goodies_status', 'pending'),
            "goodies_note": getattr(c, 'goodies_note', ''),
            "scanned_at": c.scanned_at.isoformat() if c.scanned_at else None,
            "scanned_by": c.scanned_by.get_full_name() if c.scanned_by else ''
        } for c in checkins]
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def network_list(request):
    role = (request.GET.get('role') or '').strip()
    search = (request.GET.get('search') or '').strip()
    interest = (request.GET.get('interest') or '').strip()

    is_staff_user = getattr(request.user, 'role', '') in ['super_admin', 'mgmt_admin', 'team_head', 'staff']
    user_is_checked_in = is_staff_user or CheckIn.objects.filter(user=request.user).exists()

    if role == 'speaker':
        users = User.objects.filter(role='speaker', is_active=True)
    else:
        checkin_user_ids = list(CheckIn.objects.values_list('user_id', flat=True))
        users = User.objects.filter(
            models.Q(id__in=checkin_user_ids) | models.Q(role='speaker'),
            is_active=True,
        )

    if getattr(request.user, 'is_authenticated', False):
        users = users.exclude(id=request.user.id)
        from apps.chat.models import BlockedUser
        blocked_ids = set(BlockedUser.objects.filter(blocker=request.user).values_list('blocked_id', flat=True))
        blocked_by_ids = set(BlockedUser.objects.filter(blocked=request.user).values_list('blocker_id', flat=True))
        all_blocked = blocked_ids | blocked_by_ids
        if all_blocked:
            users = users.exclude(id__in=all_blocked)

    if search:
        users = users.filter(
            models.Q(first_name__icontains=search) |
            models.Q(last_name__icontains=search) |
            models.Q(affiliation__icontains=search) |
            models.Q(designation__icontains=search) |
            models.Q(research_interests__icontains=search)
        )

    if interest:
        users = users.filter(research_interests__icontains=interest)

    all_interests_raw = User.objects.filter(
        models.Q(id__in=CheckIn.objects.values_list('user_id', flat=True)) | models.Q(role='speaker'),
        is_active=True,
    ).exclude(research_interests='').values_list('research_interests', flat=True)

    tag_counts = {}
    for raw in all_interests_raw:
        tags = raw if isinstance(raw, list) else str(raw or '').split(',')
        for t in tags:
            cleaned = str(t).strip()
            if cleaned:
                tag_counts[cleaned] = tag_counts.get(cleaned, 0) + 1

    sorted_interests = [tag for tag, _ in sorted(tag_counts.items(), key=lambda x: -x[1])]
    attendees_data = [_user_detail(u, request) for u in users[:120]]

    return Response({
        "success": True,
        "is_checked_in": user_is_checked_in,
        "attendees": attendees_data,
        "users": attendees_data,
        "interests": sorted_interests[:25],
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def meal_window_toggle(request):
    action = request.data.get('action') or request.data.get('is_open')
    requested_meal_type = (request.data.get('meal_type') or request.data.get('meal_name') or 'Lunch').strip()

    if action == 'open' or action is True:
        target_state = True
    else:
        target_state = False

    today = timezone.now().astimezone(IST).date()

    # Safely query latest window without triggering MultipleObjectsReturned
    window = MealWindow.objects.filter(date=today).order_by('-id').first()
    if not window:
        window = MealWindow.objects.create(date=today, is_open=target_state, meal_type=requested_meal_type)

    window.is_open = target_state
    if target_state:
        window.meal_type = requested_meal_type
    window.opened_by = request.user
    if not target_state:
        window.closed_at = timezone.now()
    window.save()

    active_meal_name = window.meal_type or "Meal"

    if target_state:
        push_to_checked_in(
            title=f"🍽️ {active_meal_name} service is now open!",
            body=f"Dining service for {active_meal_name} is active.",
            data={"type": "meal_pass", "screen": "qr"}
        )
    else:
        push_to_checked_in(
            title=f"🛑 {active_meal_name} service is now closed",
            body=f"Dining service for {active_meal_name} has concluded.",
            data={"type": "meal_pass", "screen": "qr"}
        )

    return Response({
        "success": True,
        "status": "success",
        "is_open": window.is_open,
        "meal_type": active_meal_name,
        "meal_window": {
            "is_open": window.is_open,
            "meal_type": active_meal_name,
            "start_time": window.start_time.strftime("%I:%M %p") if window.start_time else "12:00 PM",
            "end_time": window.end_time.strftime("%I:%M %p") if window.end_time else "02:00 PM"
        }
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def meal_push_notification(request):
    today = timezone.now().astimezone(IST).date()
    window = MealWindow.objects.filter(date=today).order_by('-id').first()
    if not window or not window.is_open:
        return Response({"success": False, "error": "No active meal window is open."}, status=400)

    meal_name = window.meal_type or "Meal"
    push_to_checked_in(
        title=f"🍽️ Reminder: {meal_name} is open!",
        body=f"Dining service for {meal_name} is currently open.",
        data={"type": "meal_pass", "screen": "qr"}
    )
    return Response({"success": True, "message": f"Push notification sent for {meal_name}!"})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def meal_window_schedule(request):
    return Response({"success": True})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def meal_stats(request):
    today = timezone.now().astimezone(IST).date()
    total = MealPass.objects.filter(date=today).count()
    used = MealPass.objects.filter(date=today, used=True).count()
    return Response({"success": True, "total_issued": total, "total_redeemed": used})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def meal_list(request):
    today = timezone.now().astimezone(IST).date()
    passes = MealPass.objects.select_related('user', 'scanned_by').filter(date=today).order_by('-used_at', '-created_at')[:100]
    return Response({
        "success": True,
        "passes": [{
            "id": str(p.id),
            "user": _user_detail(p.user, request) if p.user else {
                "id": None, "name": p.guest_name or "Guest Attendee", "email": p.guest_email or "",
                "registration_id": p.guest_reg_no or "GUEST"
            },
            "display_name": p.display_name,
            "meal_type": p.meal_type or "Meal",
            "used": p.used,
            "used_at": p.used_at.isoformat() if p.used_at else None,
            "scanned_by": p.scanned_by.get_full_name() if p.scanned_by else "System",
            "date": str(p.date)
        } for p in passes]
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def checked_in_participants(request):
    checkin_user_ids = CheckIn.objects.values_list('user_id', flat=True)
    users = User.objects.filter(id__in=checkin_user_ids)
    return Response({"success": True, "participants": [_user_detail(u, request) for u in users]})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_meal_pass_api(request):
    today = timezone.now().astimezone(IST).date()
    guest_name = request.data.get('guest_name', '').strip()
    guest_email = request.data.get('guest_email', '').strip()
    guest_phone = request.data.get('guest_phone', '').strip()
    guest_reg_no = request.data.get('guest_reg_no', '').strip()
    meal_type = request.data.get('meal_type', 'Lunch').strip() or 'Lunch'

    mp = MealPass.objects.create(
        guest_name=guest_name,
        guest_email=guest_email,
        guest_phone=guest_phone,
        guest_reg_no=guest_reg_no,
        meal_type=meal_type,
        date=today,
        is_active=True
    )

    email_sent = False
    if guest_email:
        try:
            qr = qrcode.QRCode(version=1, box_size=10, border=4)
            qr.add_data(str(mp.id))
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            img_data = buffer.getvalue()

            subject = f"Your ETD 2026 {meal_type} Pass"
            message_body = f"Hello {guest_name},\n\nPlease find attached your official {meal_type} pass QR code for ETD 2026.\n\nWarm regards,\nETD 2026 Organising Team"
            
            email = EmailMessage(
                subject,
                message_body,
                settings.DEFAULT_FROM_EMAIL,
                [guest_email]
            )
            email.attach(f"meal_pass_{mp.id}.png", img_data, "image/png")
            email.send(fail_silently=False)
            email_sent = True
        except Exception as e:
            print("Failed to send guest pass email:", e)

    return Response({
        "success": True,
        "status": "success",
        "email_sent": email_sent,
        "pass": {
            "id": str(mp.id),
            "qr_data": str(mp.id),
            "display_name": mp.display_name
        }
    }, status=201)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_meal_passes(request):
    today = timezone.now().astimezone(IST).date()
    passes = MealPass.objects.filter(user=request.user, date=today)
    return Response({"success": True, "passes": [{"id": str(p.id), "qr_data": str(p.id), "meal_type": p.meal_type, "used": p.used} for p in passes]})
