from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    # Web Admin Panel
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

    # API routes
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
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
