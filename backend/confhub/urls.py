from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from confhub.media import serve_media

urlpatterns = [
    # ── Web Admin Panel ──
    path('panel/', include('apps.accounts.admin_urls')),
    path('panel/', include('apps.notifications.admin_urls')),
    path('panel/', include('apps.checkins.admin_urls')),
    path('panel/', include('apps.sponsors.admin_urls')),
    path('panel/', include('apps.speakers.admin_urls')),
    path('panel/', include('apps.chat.admin_urls')),
    path('panel/', include('apps.schedule.admin_urls')),
    path('panel/', include('apps.leaderboard.admin_urls')),
    path('panel/', include('apps.photos.admin_urls')),
    path('panel/', include('apps.polls.admin_urls')),
    path('panel/', include('apps.posts.admin_urls')),
    path('panel/', include('apps.error_reports.admin_urls')),
    path('panel/', include('apps.certificates.admin_urls')),

    # ── Mobile API ──
    path('api/v1/auth/',          include('apps.accounts.urls')),
    path('api/v1/conferences/',   include('apps.conferences.urls')),
    path('api/v1/events/',        include('apps.events.urls')),
    path('api/v1/photos/',        include('apps.photos.urls')),
    path('api/v1/polls/',         include('apps.polls.urls')),
    path('api/v1/posts/',         include('apps.posts.urls')),
    path('api/v1/checkins/',      include('apps.checkins.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/leaderboard/',   include('apps.leaderboard.urls')),
    path('api/v1/sponsors/',      include('apps.sponsors.urls')),
    path('api/v1/speakers/',      include('apps.speakers.urls')),
    path('api/v1/schedule/',      include('apps.schedule.urls')),
    path('api/v1/chat/',          include('apps.chat.urls')),
    path('api/v1/error-reports/', include('apps.error_reports.urls')),
    path('api/v1/certificates/',  include('apps.certificates.urls')),
]

# Serve media files in all environments (static() returns [] when DEBUG=False)
from django.urls import re_path
urlpatterns += [re_path(r'^media/(?P<path>.*)$', serve_media, {'document_root': settings.MEDIA_ROOT})]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# ── Custom Error Handlers ──
handler404 = 'confhub.error_views.handler404'
handler500 = 'confhub.error_views.handler500'
handler403 = 'confhub.error_views.handler403'
