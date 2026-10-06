import json
import base64
import uuid
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.files.base import ContentFile
from .models import ErrorReport, ErrorReportScreenshot, SystemLogEntry
from .log_utils import get_server_log_tail, get_system_health

ADMIN_ROLES = ['super_admin', 'mgmt_admin', 'team_head', 'staff']


# ── USER SUBMISSION ENDPOINTS ────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def submit_error_report(request):
    description = request.data.get('description', '').strip()
    category    = request.data.get('category', 'ui_ux')
    title       = request.data.get('title', '').strip()
    user_phone  = request.data.get('user_phone', '').strip()

    if not description:
        return Response({'success': False, 'error': 'Error description is required.'}, status=status.HTTP_400_BAD_REQUEST)

    device_info_raw = request.data.get('device_info', {})
    if isinstance(device_info_raw, str) and device_info_raw.startswith('{'):
        try:
            device_info = json.loads(device_info_raw)
        except Exception:
            device_info = {'raw': device_info_raw}
    elif isinstance(device_info_raw, dict) and device_info_raw:
        device_info = device_info_raw
    else:
        device_info = {
            'os': request.data.get('os', ''),
            'os_version': request.data.get('os_version', ''),
            'screen_width': request.data.get('screen_width', ''),
            'screen_height': request.data.get('screen_height', ''),
            'user_email': request.data.get('user_email', ''),
            'user_name': request.data.get('user_name', ''),
            'user_phone': user_phone,
        }

    user = request.user
    user_name = f"{user.first_name} {user.last_name}".strip() or user.email
    final_phone = user_phone or getattr(user, 'phone', '') or device_info.get('user_phone', '')

    report = ErrorReport.objects.create(
        user=user,
        user_email=user.email,
        user_name=user_name,
        user_phone=final_phone,
        category=category,
        title=title or description[:60],
        description=description,
        device_info=device_info,
        status='new',
        severity=request.data.get('severity', 'medium'),
    )

    created_screenshots = []

    # 1. Parse Multipart Files if present
    images = request.FILES.getlist('screenshots') or request.FILES.getlist('images') or request.FILES.getlist('image')
    for img in images:
        ss = ErrorReportScreenshot.objects.create(report=report, image=img)
        created_screenshots.append(request.build_absolute_uri(ss.image.url))

    # 2. Parse Base64 Image Strings safely
    screenshots_b64 = request.data.get('screenshots_base64') or []
    if isinstance(screenshots_b64, list):
        for idx, b64_str in enumerate(screenshots_b64):
            try:
                if not isinstance(b64_str, str) or not b64_str.strip():
                    continue

                data_str = b64_str.strip()
                ext = 'jpg'

                if 'base64,' in data_str:
                    header, data_str = data_str.split('base64,', 1)
                    if 'image/png' in header:
                        ext = 'png'
                    elif 'image/webp' in header:
                        ext = 'webp'

                # Strip any non-ASCII characters cleanly
                data_str = data_str.encode('ascii', 'ignore').decode('ascii').strip()

                # Fix Base64 padding
                missing_padding = len(data_str) % 4
                if missing_padding:
                    data_str += '=' * (4 - missing_padding)

                img_data = base64.b64decode(data_str)
                file_name = f"ss_{str(report.id)[:8]}_{idx + 1}_{uuid.uuid4().hex[:4]}.{ext}"
                content_file = ContentFile(img_data, name=file_name)
                ss = ErrorReportScreenshot.objects.create(report=report, image=content_file)
                created_screenshots.append(request.build_absolute_uri(ss.image.url))
            except Exception as e:
                print(f"Base64 screenshot decode note: {e}")

    return Response({
        'success': True,
        'message': 'Error report submitted successfully.',
        'report_id': str(report.id),
        'screenshot_count': len(created_screenshots),
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_error_reports(request):
    reports = ErrorReport.objects.filter(user=request.user).order_by('-created_at')[:30]
    data = []
    for r in reports:
        data.append({
            'id': str(r.id),
            'title': r.title,
            'category': r.category,
            'category_display': r.get_category_display(),
            'description': r.description,
            'status': r.status,
            'severity': r.severity,
            'user_phone': r.user_phone,
            'created_at': r.created_at.isoformat(),
            'screenshots': [request.build_absolute_uri(s.image.url) for s in r.screenshots.all()],
            'admin_notes': r.admin_notes or '',
        })
    return Response({'success': True, 'reports': data})


# ── FULL ADMIN MOBILE CRUD & LOGS ENDPOINTS ──────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_list_reports(request):
    if getattr(request.user, 'role', '') not in ADMIN_ROLES:
        return Response({'success': False, 'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    status_filter = request.query_params.get('status', '')
    category_filter = request.query_params.get('category', '')
    
    qs = ErrorReport.objects.all().select_related('user').prefetch_related('screenshots')
    if status_filter and status_filter != 'all':
        qs = qs.filter(status=status_filter)
    if category_filter and category_filter != 'all':
        qs = qs.filter(category=category_filter)

    results = []
    for r in qs[:60]:
        results.append({
            'id': str(r.id),
            'user_name': r.user_name or (r.user.email if r.user else 'Anonymous'),
            'user_email': r.user_email,
            'user_phone': r.user_phone or (r.user.phone if r.user else ''),
            'category': r.category,
            'category_display': r.get_category_display(),
            'title': r.title,
            'description': r.description,
            'status': r.status,
            'severity': r.severity,
            'device_info': r.device_info,
            'admin_notes': r.admin_notes,
            'screenshots': [request.build_absolute_uri(s.image.url) for s in r.screenshots.all()],
            'created_at': r.created_at.isoformat(),
        })

    return Response({'success': True, 'reports': results})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def admin_create_report(request):
    """Admin CRUD: Create a ticket directly."""
    if getattr(request.user, 'role', '') not in ADMIN_ROLES:
        return Response({'success': False, 'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    title       = request.data.get('title', '').strip()
    description = request.data.get('description', '').strip()
    category    = request.data.get('category', 'other')
    severity    = request.data.get('severity', 'medium')
    status_val  = request.data.get('status', 'new')
    user_phone  = request.data.get('user_phone', '').strip()
    admin_notes = request.data.get('admin_notes', '')

    if not description:
        return Response({'success': False, 'error': 'Description required'}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    report = ErrorReport.objects.create(
        user=user,
        user_email=user.email,
        user_name=f"{user.first_name} {user.last_name}".strip() or user.email,
        user_phone=user_phone or getattr(user, 'phone', ''),
        category=category,
        title=title or description[:60],
        description=description,
        severity=severity,
        status=status_val,
        admin_notes=admin_notes,
        device_info={'source': 'Created by Admin via Mobile/Web'},
    )

    images = request.FILES.getlist('screenshots') or request.FILES.getlist('images') or request.FILES.getlist('image')
    for img in images:
        ErrorReportScreenshot.objects.create(report=report, image=img)

    return Response({'success': True, 'message': 'Ticket created', 'id': str(report.id)}, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'PUT'])
@permission_classes([IsAuthenticated])
def admin_update_report_status(request, pk):
    """Admin CRUD: Update status, severity, title, description, phone, or notes."""
    if getattr(request.user, 'role', '') not in ADMIN_ROLES:
        return Response({'success': False, 'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    report = get_object_or_404(ErrorReport, pk=pk)

    if 'status' in request.data:
        new_status = request.data['status']
        if new_status in ['new', 'in_progress', 'resolved', 'closed']:
            report.status = new_status
            if new_status == 'resolved':
                report.resolved_by = request.user
                report.resolved_at = timezone.now()

    if 'title' in request.data:
        report.title = request.data['title'].strip()

    if 'description' in request.data:
        report.description = request.data['description'].strip()

    if 'admin_notes' in request.data:
        report.admin_notes = request.data['admin_notes']

    if 'severity' in request.data:
        report.severity = request.data['severity']

    if 'category' in request.data:
        report.category = request.data['category']

    if 'user_phone' in request.data:
        report.user_phone = request.data['user_phone'].strip()

    report.save()
    return Response({'success': True, 'message': 'Ticket updated successfully.'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_delete_report(request, pk):
    """Admin CRUD: Delete ticket."""
    if getattr(request.user, 'role', '') not in ADMIN_ROLES:
        return Response({'success': False, 'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    report = get_object_or_404(ErrorReport, pk=pk)
    report.delete()
    return Response({'success': True, 'message': 'Report removed.'})


# ── LOGS & HEALTH ENDPOINTS (MOBILE ADMIN VIEW) ──────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_server_logs(request):
    if getattr(request.user, 'role', '') not in ADMIN_ROLES:
        return Response({'success': False, 'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    lines_count = int(request.query_params.get('lines', 150))
    lines = get_server_log_tail(lines_count)
    return Response({
        'success': True,
        'lines': lines,
        'total_lines': len(lines),
        'timestamp': timezone.now().strftime('%H:%M:%S'),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_system_logs(request):
    if getattr(request.user, 'role', '') not in ADMIN_ROLES:
        return Response({'success': False, 'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    logs = SystemLogEntry.objects.all()[:60]
    data = []
    for l in logs:
        data.append({
            'id': str(l.id),
            'log_type': l.log_type,
            'log_type_display': l.get_log_type_display(),
            'level': l.level,
            'message': l.message,
            'traceback': l.traceback,
            'path': l.path,
            'method': l.method,
            'user_email': l.user_email,
            'ip_address': l.ip_address,
            'created_at': l.created_at.strftime('%b %d, %H:%M:%S'),
        })
    return Response({'success': True, 'system_logs': data})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_clear_system_logs(request):
    if getattr(request.user, 'role', '') not in ADMIN_ROLES:
        return Response({'success': False, 'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    SystemLogEntry.objects.all().delete()
    return Response({'success': True, 'message': 'System logs cleared.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_system_health(request):
    if getattr(request.user, 'role', '') not in ADMIN_ROLES:
        return Response({'success': False, 'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    health = get_system_health()
    counts = {
        'total_reports': ErrorReport.objects.count(),
        'new_reports': ErrorReport.objects.filter(status='new').count(),
        'system_errors': SystemLogEntry.objects.filter(level__in=['ERROR', 'CRITICAL']).count(),
    }
    return Response({'success': True, 'health': health, 'counts': counts})
