import csv
import io
import json
import logging
import os
import threading
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render

from apps.accounts.models import User
from apps.accounts.permissions_helper import module_required
from apps.checkins.models import CheckIn
from .generator import generate_certificate_pdf
from .models import (
    CertificateBatchJob,
    CertificateConfig,
    CertificateField,
    CertificateTemplate,
    IssuedCertificate,
)

logger = logging.getLogger(__name__)


@login_required
@module_required('certificates')
def certificates_dashboard(request):
    templates = CertificateTemplate.objects.all().order_by('-created_at')
    recent_jobs = CertificateBatchJob.objects.all().order_by('-created_at')[:10]
    total_issued = IssuedCertificate.objects.count()
    config = CertificateConfig.get()
    return render(request, 'panel/certificates.html', {
        'templates': templates,
        'recent_jobs': recent_jobs,
        'total_issued': total_issued,
        'config': config,
    })


@login_required
@module_required('certificates')
def template_form(request, pk=None):
    template = get_object_or_404(CertificateTemplate, pk=pk) if pk else None
    fields = template.fields.all() if template else []

    if request.method == 'POST':
        action = request.POST.get('action', 'save')

        if action == 'delete' and template:
            template.delete()
            messages.success(request, 'Template deleted.')
            return redirect('panel_certificates')

        if action == 'save':
            if not template:
                template = CertificateTemplate()
            template.title = request.POST.get('title', '').strip()
            template.description = request.POST.get('description', '').strip()
            template.is_active = request.POST.get('is_active') == 'on'
            if request.FILES.get('bg_image'):
                template.bg_image = request.FILES['bg_image']
            template.save()

            # Save fields from JSON
            fields_json = request.POST.get('fields_json', '[]')
            try:
                fields_data = json.loads(fields_json)
            except Exception:
                fields_data = []

            # Delete old fields, recreate
            template.fields.all().delete()
            for f in fields_data:
                CertificateField.objects.create(
                    template=template,
                    field_key=f.get('field_key', 'field'),
                    label=f.get('label', 'Field'),
                    data_source=f.get('data_source', 'custom'),
                    custom_text=f.get('custom_text', ''),
                    x=int(f.get('x', 0)),
                    y=int(f.get('y', 0)),
                    font_size=int(f.get('font_size', 42)),
                    min_font_size=int(f.get('min_font_size', 18)),
                    font_color=f.get('font_color', '#1a1a1a'),
                    max_width=int(f.get('max_width', 0)),
                    text_align=f.get('text_align', 'center'),
                    is_bold=bool(f.get('is_bold', False)),
                    font_family=f.get('font_family', 'DejaVuSans') or 'DejaVuSans',
                    line_height=float(f.get('line_height', 1.3)),
                )

            messages.success(request, f'Template "{template.title}" saved with {len(fields_data)} fields.')
            return redirect('panel_certificates')

    return render(request, 'panel/certificate_template_form.html', {
        'template': template,
        'fields': fields,
    })


@login_required
@module_required('certificates')
def settings_view(request):
    config = CertificateConfig.get()
    if request.method == 'POST':
        config.authority_name = request.POST.get('authority_name', config.authority_name)
        config.authority_title = request.POST.get('authority_title', config.authority_title)
        config.organization = request.POST.get('organization', config.organization)
        config.email_subject = request.POST.get('email_subject', config.email_subject)
        config.email_body = request.POST.get('email_body', config.email_body)
        config.save()
        messages.success(request, 'Certificate settings updated.')
        return redirect('panel_certificates')
    return render(request, 'panel/certificate_settings.html', {'config': config})


@login_required
@module_required('certificates')
def issue_certificates(request):
    """Start a bulk certificate generation job or handle CSV upload."""
    if request.method != 'POST':
        return redirect('panel_certificates')

    template_id = request.POST.get('template_id')
    template = get_object_or_404(CertificateTemplate, pk=template_id)
    recipient_type = request.POST.get('recipient_type', 'all_participants')
    send_push = request.POST.get('send_push') == 'on'
    send_email = request.POST.get('send_email') == 'on'

    csv_data = None
    if recipient_type == 'csv':
        csv_file = request.FILES.get('csv_file')
        if not csv_file:
            messages.error(request, 'Please upload a CSV file.')
            return redirect('panel_certificates')
        try:
            decoded_file = csv_file.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(decoded_file))
            csv_data = [row for row in reader if row.get('email')]
        except Exception as e:
            messages.error(request, f'CSV Error: {e}')
            return redirect('panel_certificates')

        users = User.objects.none()
        total_count = len(csv_data)
    else:
        users = _resolve_recipients(recipient_type, request.POST)
        total_count = users.count()

    if total_count == 0:
        messages.warning(request, 'No recipients found for the selected criteria.')
        return redirect('panel_certificates')

    # Create batch job
    job = CertificateBatchJob.objects.create(
        template=template,
        total_count=total_count,
        send_push=send_push,
        send_email=send_email,
        created_by=request.user,
        status='running',
    )

    # Start background thread
    user_ids = list(users.values_list('id', flat=True)) if users else []
    thread = threading.Thread(
        target=_run_batch_generation,
        args=(job.pk, template.pk, user_ids, send_push, send_email, csv_data),
        daemon=True,
    )
    thread.start()

    messages.success(request, f'Generating {job.total_count} certificates in background. Check progress below.')
    return redirect('panel_certificates')


@login_required
@module_required('certificates')
def batch_status(request, job_id):
    """AJAX endpoint for polling batch progress."""
    job = get_object_or_404(CertificateBatchJob, pk=job_id)
    return JsonResponse({
        'status': job.status,
        'total': job.total_count,
        'completed': job.completed_count,
        'failed': job.failed_count,
        'error_log': job.error_log[-500:] if job.error_log else '',
    })


@login_required
@module_required('certificates')
def reissue_certificate(request, pk):
    """Re-issue a certificate (delete old, generate new)."""
    cert = get_object_or_404(IssuedCertificate, pk=pk)
    if request.method == 'POST':
        try:
            pdf_path = generate_certificate_pdf(cert.template, cert.user)
            cert.generated_pdf = pdf_path
            config = CertificateConfig.get()
            cert.issued_by_name = config.authority_name
            cert.save()
            messages.success(request, f'Certificate re-issued for {cert.user.email}.')
        except Exception as e:
            messages.error(request, f'Error: {e}')
    return redirect('panel_certificates')


@login_required
@module_required('certificates')
def delete_certificate(request, pk):
    cert = get_object_or_404(IssuedCertificate, pk=pk)
    if request.method == 'POST':
        cert.delete()
        messages.success(request, 'Certificate deleted.')
    return redirect('panel_certificates')


@login_required
@module_required('certificates')
def search_users(request):
    """AJAX: search participants by name or email for certificate recipient picker."""
    q = (request.GET.get('q') or '').strip()
    if len(q) < 2:
        return JsonResponse({'results': []})

    users = User.objects.filter(
        Q(email__icontains=q) |
        Q(first_name__icontains=q) |
        Q(last_name__icontains=q) |
        Q(affiliation__icontains=q)
    ).filter(is_active=True).order_by('first_name', 'last_name')[:30]

    results = []
    for u in users:
        name = u.get_full_name() or u.email
        results.append({
            'id': str(u.id),
            'name': name,
            'email': u.email,
            'role': u.role or 'participant',
            'affiliation': getattr(u, 'affiliation', '') or '',
            'designation': getattr(u, 'designation', '') or '',
        })
    return JsonResponse({'results': results})



from django.http import HttpResponse

@login_required
@module_required('certificates')
def download_csv_template(request):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="certificate_recipients_template.csv"'
    writer = csv.writer(response)
    writer.writerow(['email', 'name', 'designation', 'affiliation', 'paper_title', 'award_name', 'dynamic_text'])
    writer.writerow(['judges_choice@example.com', 'Dr. Jane Doe', 'Professor', 'IIT Delhi', 'AI in ETDs', 'Best Insight Paper Award', 'First Prize'])
    writer.writerow(['another_winner@example.com', 'John Smith', 'Scholar', 'MIT', 'Future of Repositories', 'Best Poster Award', 'Runner Up'])
    return response

def _resolve_recipients(recipient_type, post_data):
    """Resolve recipient type to a User queryset."""
    if recipient_type == 'all_participants':
        checked_in = CheckIn.objects.filter(checkin_type='conference').values_list('user_id', flat=True)
        return User.objects.filter(id__in=checked_in)
    elif recipient_type == 'all_speakers':
        try:
            from apps.speakers.models import Speaker
            speaker_users = Speaker.objects.exclude(user=None).values_list('user_id', flat=True)
            return User.objects.filter(id__in=speaker_users)
        except Exception:
            return User.objects.none()

    elif recipient_type == 'top_3_leaderboard':
        try:
            from apps.leaderboard.models import UserPoints
            top_users = UserPoints.objects.order_by('-total')[:3].values_list('user_id', flat=True)
            return User.objects.filter(id__in=top_users)
        except Exception: return User.objects.none()
    elif recipient_type == 'top_photo_uploader':
        try:
            from apps.photos.models import Photo
            from django.db.models import Count
            top = Photo.objects.exclude(user=None).values('user').annotate(c=Count('id')).order_by('-c').first()
            if top: return User.objects.filter(id=top['user'])
        except Exception: pass
        return User.objects.none()
    elif recipient_type == 'top_selfie_uploader':
        try:
            from apps.photos.models import SelfieSubmission
            from django.db.models import Count
            top = SelfieSubmission.objects.exclude(user=None).values('user').annotate(c=Count('id')).order_by('-c').first()
            if top: return User.objects.filter(id=top['user'])
        except Exception: pass
        return User.objects.none()
    elif recipient_type == 'all_users':
        return User.objects.filter(is_active=True)
    elif recipient_type == 'role':
        role = post_data.get('role', 'participant')
        return User.objects.filter(role=role, is_active=True)
    elif recipient_type == 'manual':
        user_ids = post_data.getlist('user_ids')
        if not user_ids:
            raw = post_data.get('user_ids_csv', '') or ''
            user_ids = [x.strip() for x in raw.split(',') if x.strip()]
        return User.objects.filter(id__in=user_ids)
    return User.objects.none()


def _run_batch_generation(job_id, template_id, user_ids, send_push, send_email, csv_data=None):
    """Background thread for bulk certificate generation."""
    import os as _os
    from django import setup as django_setup

    _os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
    django_setup()

    from .generator import generate_certificate_pdf
    from .models import (
        CertificateBatchJob,
        CertificateConfig,
        CertificateTemplate,
        IssuedCertificate,
    )

    job = CertificateBatchJob.objects.get(pk=job_id)
    template = CertificateTemplate.objects.get(pk=template_id)
    config = CertificateConfig.get()

    items = csv_data if csv_data else [{'user_id': uid} for uid in user_ids]
    for item in items:
        try:
            user = None
            if 'user_id' in item:
                user = User.objects.filter(pk=item['user_id']).first()
            elif 'email' in item and item['email']:
                user = User.objects.filter(email__iexact=item['email'].strip()).first()

            # Generate PDF (uses CSV data if present, fallbacks to user)
            pdf_path = generate_certificate_pdf(template, user=user, csv_row=item if csv_data else None)

            # Save to app ONLY if registered user exists
            if user:
                cert, _ = IssuedCertificate.objects.update_or_create(
                    template=template,
                    user=user,
                    defaults={
                        'generated_pdf': pdf_path,
                        'issued_by_name': config.authority_name,
                    },
                )

            # Push notification
            if send_push and user:
                try:
                    from apps.notifications.fcm import send_to_user
                    send_to_user(
                        user,
                        title='🏅 New Certificate!',
                        body=f'You received "{template.title}". Tap to view.',
                        data={'type': 'certificate', 'screen': 'certificates'},
                    )
                except Exception as e:
                    logger.warning(f'Push failed for {user.email}: {e}')

            # Email with PDF attachment
            if send_email:
                try:
                    full_pdf = _os.path.join(settings.MEDIA_ROOT, str(pdf_path))
                    target_email = user.email if user else item.get('email')
                    target_name = (user.get_full_name() if user else item.get('name')) or target_email
                    if target_email and _os.path.exists(full_pdf):
                        subject = config.email_subject
                        body = config.email_body.replace('{name}', target_name)
                        email = EmailMessage(
                            subject=subject,
                            body=body,
                            from_email=settings.DEFAULT_FROM_EMAIL,
                            to=[target_email.strip()],
                        )
                        email.attach_file(full_pdf)
                        email.send(fail_silently=True)
                except Exception as e:
                    logger.warning(f'Email failed: {e}')

            job.completed_count += 1
            job.save(update_fields=['completed_count'])

        except Exception as e:
            job.failed_count += 1
            job.error_log += f'\nItem {item}: {str(e)}'
            job.save(update_fields=['failed_count', 'error_log'])

    job.status = 'completed' if job.failed_count == 0 else 'completed'
    job.save(update_fields=['status'])
