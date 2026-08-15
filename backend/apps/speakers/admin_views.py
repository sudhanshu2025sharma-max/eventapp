from django.shortcuts import render, redirect, get_object_or_404
from django.views.decorators.http import require_POST
from django.contrib import messages
from django.contrib.auth.hashers import make_password

import secrets
import string

from apps.accounts.admin_views import admin_required
from apps.accounts.models import User
from .models import Speaker, SpeakerTalk


def _generate_temp_password(length=10):
    """Generate secure temporary password."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def _sync_speaker_to_user(speaker, user):
    """Sync speaker profile data to linked user account."""
    user.first_name = speaker.first_name
    user.last_name = speaker.last_name
    user.designation = speaker.designation or user.designation
    user.affiliation = speaker.institute or user.affiliation
    user.bio = speaker.bio or user.bio
    user.linkedin_url = speaker.linkedin_url or user.linkedin_url
    if speaker.photo:
        user.profile_photo = speaker.photo.name
    user.save()


# ─── Speakers List ──────────────────────────────────────────────────────────

@admin_required
def speakers_panel(request):
    keynotes = Speaker.objects.select_related('user').filter(is_keynote=True).prefetch_related('talks')
    regulars = Speaker.objects.select_related('user').filter(is_keynote=False).prefetch_related('talks')
    return render(request, 'panel/speakers_list.html', {
        'keynotes': keynotes,
        'regulars': regulars,
        'total': Speaker.objects.count(),
        'active': Speaker.objects.filter(is_active=True).count(),
        'linked': Speaker.objects.filter(user__isnull=False).count(),
    })


# ─── Create Speaker ──────────────────────────────────────────────────────────

@admin_required
def speaker_create(request):
    if request.method == 'POST':
        try:
            login_email = request.POST.get('login_email', '').strip().lower()
            create_account = request.POST.get('create_account') == 'on'
            
            speaker = Speaker(
                title         = request.POST.get('title', ''),
                first_name    = request.POST.get('first_name', '').strip(),
                last_name     = request.POST.get('last_name', '').strip(),
                designation   = request.POST.get('designation', '').strip(),
                institute     = request.POST.get('institute', '').strip(),
                country       = request.POST.get('country', '').strip(),
                bio           = request.POST.get('bio', '').strip(),
                email         = request.POST.get('email', '').strip(),
                website_url        = request.POST.get('website_url', '').strip(),
                linkedin_url       = request.POST.get('linkedin_url', '').strip(),
                google_scholar_url = request.POST.get('google_scholar_url', '').strip(),
                researchgate_url   = request.POST.get('researchgate_url', '').strip(),
                twitter_url        = request.POST.get('twitter_url', '').strip(),
                is_keynote    = request.POST.get('is_keynote') == 'on',
                is_active     = request.POST.get('is_active') == 'on',
                display_order = int(request.POST.get('display_order', 0) or 0),
            )
            if 'photo' in request.FILES:
                speaker.photo = request.FILES['photo']
            speaker.save()
            
            # Create linked user account if requested
            if create_account and login_email:
                if User.objects.filter(email=login_email).exists():
                    messages.warning(request, f'User with email {login_email} already exists. Linking to existing account.')
                    user = User.objects.get(email=login_email)
                else:
                    temp_pwd = _generate_temp_password()
                    user = User.objects.create_user(
                        email=login_email,
                        password=temp_pwd,
                        first_name=speaker.first_name,
                        last_name=speaker.last_name,
                    )
                    user.role = 'speaker'
                    user.is_active = True
                    user.must_change_password = True
                    user.save()
                    messages.success(
                        request,
                        f'✅ Speaker created. Login: {login_email} | Temp Password: {temp_pwd}',
                        extra_tags='credentials'
                    )
                
                speaker.user = user
                speaker.save()
                _sync_speaker_to_user(speaker, user)
            
            messages.success(request, f'Speaker "{speaker.full_name}" created successfully.')
            return redirect('speakers_panel')
        except Exception as e:
            messages.error(request, f'Error creating speaker: {e}')

    return render(request, 'panel/speaker_form.html', {
        'action': 'Create', 'speaker': None,
        'title_choices': Speaker.TITLE_CHOICES,
    })


# ─── Edit Speaker ─────────────────────────────────────────────────────────────

@admin_required
def speaker_edit(request, pk):
    speaker = get_object_or_404(Speaker.objects.select_related('user'), pk=pk)

    if request.method == 'POST':
        try:
            speaker.title         = request.POST.get('title', '')
            speaker.first_name    = request.POST.get('first_name', '').strip()
            speaker.last_name     = request.POST.get('last_name', '').strip()
            speaker.designation   = request.POST.get('designation', '').strip()
            speaker.institute     = request.POST.get('institute', '').strip()
            speaker.country       = request.POST.get('country', '').strip()
            speaker.bio           = request.POST.get('bio', '').strip()
            speaker.email         = request.POST.get('email', '').strip()
            speaker.website_url        = request.POST.get('website_url', '').strip()
            speaker.linkedin_url       = request.POST.get('linkedin_url', '').strip()
            speaker.google_scholar_url = request.POST.get('google_scholar_url', '').strip()
            speaker.researchgate_url   = request.POST.get('researchgate_url', '').strip()
            speaker.twitter_url        = request.POST.get('twitter_url', '').strip()
            speaker.is_keynote    = request.POST.get('is_keynote') == 'on'
            speaker.is_active     = request.POST.get('is_active') == 'on'
            speaker.display_order = int(request.POST.get('display_order', 0) or 0)

            if 'photo' in request.FILES:
                speaker.photo = request.FILES['photo']
            elif request.POST.get('clear_photo') == 'on':
                speaker.photo = None

            speaker.save()
            
            # Sync to linked user
            if speaker.user:
                _sync_speaker_to_user(speaker, speaker.user)
            
            messages.success(request, f'Speaker "{speaker.full_name}" updated.')
            return redirect('speaker_edit', pk=speaker.pk)
        except Exception as e:
            messages.error(request, f'Error updating speaker: {e}')

    talks = speaker.talks.all()
    return render(request, 'panel/speaker_form.html', {
        'action': 'Edit', 'speaker': speaker, 'talks': talks,
        'title_choices': Speaker.TITLE_CHOICES,
    })


# ─── Manage Speaker Login Credentials ────────────────────────────────────────

@admin_required
@require_POST
def speaker_credentials(request, pk):
    """Create/update login credentials for a speaker."""
    speaker = get_object_or_404(Speaker, pk=pk)
    action = request.POST.get('action')
    
    try:
        if action == 'create_account':
            new_email = request.POST.get('login_email', '').strip().lower()
            if not new_email:
                messages.error(request, 'Email is required.')
                return redirect('speaker_edit', pk=pk)
            
            if User.objects.filter(email=new_email).exists():
                # Link to existing user
                user = User.objects.get(email=new_email)
                speaker.user = user
                speaker.save()
                _sync_speaker_to_user(speaker, user)
                messages.success(request, f'✅ Linked to existing user: {new_email}')
            else:
                # Create new user
                temp_pwd = _generate_temp_password()
                user = User.objects.create_user(
                    email=new_email,
                    password=temp_pwd,
                    first_name=speaker.first_name,
                    last_name=speaker.last_name,
                )
                user.role = 'speaker'
                user.is_active = True
                user.must_change_password = True
                user.save()
                
                speaker.user = user
                speaker.save()
                _sync_speaker_to_user(speaker, user)
                
                messages.success(
                    request,
                    f'✅ Account created!\n📧 Email: {new_email}\n🔑 Temp Password: {temp_pwd}\n\nShare these credentials with the speaker.'
                )
        
        elif action == 'change_email':
            new_email = request.POST.get('new_email', '').strip().lower()
            if not speaker.user:
                messages.error(request, 'No account linked. Create account first.')
                return redirect('speaker_edit', pk=pk)
            
            if not new_email:
                messages.error(request, 'New email is required.')
                return redirect('speaker_edit', pk=pk)
            
            if User.objects.filter(email=new_email).exclude(pk=speaker.user.pk).exists():
                messages.error(request, f'❌ Email {new_email} is already used by another user.')
                return redirect('speaker_edit', pk=pk)
            
            old_email = speaker.user.email
            temp_pwd = _generate_temp_password()
            
            speaker.user.email = new_email
            speaker.user.set_password(temp_pwd)
            speaker.user.must_change_password = True
            speaker.user.save()
            
            messages.success(
                request,
                f'✅ Credentials Updated!\n📧 Old Email: {old_email}\n📧 New Email: {new_email}\n🔑 New Password: {temp_pwd}\n\nOld email is now INVALID. Share new credentials with speaker.'
            )
        
        elif action == 'reset_password':
            if not speaker.user:
                messages.error(request, 'No account linked.')
                return redirect('speaker_edit', pk=pk)
            
            temp_pwd = _generate_temp_password()
            speaker.user.set_password(temp_pwd)
            speaker.user.must_change_password = True
            speaker.user.save()
            
            messages.success(
                request,
                f'🔑 Password reset!\n📧 Email: {speaker.user.email}\n🔑 New Temp Password: {temp_pwd}\n\nShare with speaker.'
            )
        
        elif action == 'unlink':
            if speaker.user:
                old_email = speaker.user.email
                speaker.user = None
                speaker.save()
                messages.success(request, f'🔓 Unlinked from {old_email} (account still exists)')
    
    except Exception as e:
        messages.error(request, f'Error: {e}')
    
    return redirect('speaker_edit', pk=pk)


# ─── Delete Speaker ───────────────────────────────────────────────────────────

@admin_required
@require_POST
def speaker_delete(request, pk):
    speaker = get_object_or_404(Speaker, pk=pk)
    name = speaker.full_name
    speaker.delete()
    messages.success(request, f'Speaker "{name}" deleted.')
    return redirect('speakers_panel')


# ─── Talk CRUD ────────────────────────────────────────────────────────────────

@admin_required
def talk_create(request, speaker_pk):
    speaker = get_object_or_404(Speaker, pk=speaker_pk)
    if request.method == 'POST':
        try:
            SpeakerTalk.objects.create(
                speaker       = speaker,
                title         = request.POST.get('title', '').strip(),
                abstract      = request.POST.get('abstract', '').strip(),
                track         = request.POST.get('track', '').strip(),
                talk_date     = request.POST.get('talk_date') or None,
                talk_time     = request.POST.get('talk_time', '').strip(),
                display_order = int(request.POST.get('display_order', 0) or 0),
            )
            messages.success(request, 'Talk added successfully.')
        except Exception as e:
            messages.error(request, f'Error adding talk: {e}')
    return redirect('speaker_edit', pk=speaker_pk)


@admin_required
@require_POST
def talk_delete(request, pk):
    talk = get_object_or_404(SpeakerTalk, pk=pk)
    speaker_pk = talk.speaker_id
    talk.delete()
    messages.success(request, 'Talk removed.')
    return redirect('speaker_edit', pk=speaker_pk)
