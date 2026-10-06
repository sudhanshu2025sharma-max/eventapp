from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
from apps.accounts.permissions_helper import module_required
from .models import ErrorReport, ErrorReportScreenshot, SystemLogEntry
from .log_utils import get_server_log_tail, get_system_health


@login_required(login_url='/panel/login/')
@module_required('error_reports')
def error_reports_dashboard(request):
    tab = request.GET.get('tab', 'user_reports')
    status_filter = request.GET.get('status', '')
    category_filter = request.GET.get('category', '')

    # Admin Create Ticket via Web
    if request.method == 'POST' and request.POST.get('action') == 'create_ticket':
        title = request.POST.get('title', '').strip()
        description = request.POST.get('description', '').strip()
        category = request.POST.get('category', 'other')
        severity = request.POST.get('severity', 'medium')
        user_phone = request.POST.get('user_phone', '').strip()
        
        if description:
            report = ErrorReport.objects.create(
                user=request.user,
                user_email=request.user.email,
                user_name=request.user.get_full_name() or request.user.email,
                user_phone=user_phone or getattr(request.user, 'phone', ''),
                title=title or description[:60],
                description=description,
                category=category,
                severity=severity,
                status='new',
                device_info={'source': 'Created by Admin via Web Panel'},
            )
            for f in request.FILES.getlist('screenshots'):
                ErrorReportScreenshot.objects.create(report=report, image=f)
            messages.success(request, f"Error ticket #{str(report.id)[:8]} created successfully.")
            return redirect('panel_error_reports')
        else:
            messages.error(request, "Description is required to log a ticket.")

    reports_qs = ErrorReport.objects.all().select_related('user').prefetch_related('screenshots')
    if status_filter:
        reports_qs = reports_qs.filter(status=status_filter)
    if category_filter:
        reports_qs = reports_qs.filter(category=category_filter)

    system_logs_qs = SystemLogEntry.objects.all()[:100]

    counts = {
        'total': ErrorReport.objects.count(),
        'new': ErrorReport.objects.filter(status='new').count(),
        'in_progress': ErrorReport.objects.filter(status='in_progress').count(),
        'resolved': ErrorReport.objects.filter(status='resolved').count(),
        'sys_errors': SystemLogEntry.objects.filter(level__in=['ERROR', 'CRITICAL']).count(),
    }

    health = get_system_health()

    return render(request, 'panel/error_reports.html', {
        'tab': tab,
        'reports': reports_qs[:60],
        'system_logs': system_logs_qs,
        'counts': counts,
        'health': health,
        'status_filter': status_filter,
        'category_filter': category_filter,
    })


@login_required(login_url='/panel/login/')
@module_required('error_reports')
def error_report_detail(request, pk):
    report = get_object_or_404(ErrorReport, pk=pk)
    if request.method == 'POST':
        action = request.POST.get('action', '')
        if action == 'update_status':
            report.title = request.POST.get('title', report.title).strip()
            report.category = request.POST.get('category', report.category)
            report.status = request.POST.get('status', report.status)
            report.severity = request.POST.get('severity', report.severity)
            report.user_phone = request.POST.get('user_phone', report.user_phone).strip()
            report.admin_notes = request.POST.get('admin_notes', report.admin_notes)
            if report.status == 'resolved':
                report.resolved_by = request.user
                report.resolved_at = timezone.now()
            report.save()
            messages.success(request, 'Report updated successfully.')
            return redirect('panel_error_report_detail', pk=report.pk)

        elif action == 'delete':
            report.delete()
            messages.success(request, 'Report removed.')
            return redirect('panel_error_reports')

    return render(request, 'panel/error_report_detail.html', {
        'report': report,
        'screenshots': report.screenshots.all(),
    })


@login_required(login_url='/panel/login/')
@module_required('error_reports')
def server_log_stream_ajax(request):
    lines_count = int(request.GET.get('lines', 250))
    lines = get_server_log_tail(lines_count)
    return JsonResponse({
        'success': True,
        'lines': lines,
        'total_lines': len(lines),
        'timestamp': timezone.now().strftime('%H:%M:%S'),
    })


@login_required(login_url='/panel/login/')
@module_required('error_reports')
def delete_system_logs(request):
    if request.method == 'POST':
        SystemLogEntry.objects.all().delete()
        messages.success(request, 'System logs cleared.')
    return redirect('/panel/error-reports/?tab=system_logs')
