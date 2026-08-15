from django.urls import path
from . import admin_views

urlpatterns = [
    path('speakers/',                              admin_views.speakers_panel,      name='speakers_panel'),
    path('speakers/new/',                          admin_views.speaker_create,      name='speaker_create'),
    path('speakers/<int:pk>/edit/',                admin_views.speaker_edit,        name='speaker_edit'),
    path('speakers/<int:pk>/delete/',              admin_views.speaker_delete,      name='speaker_delete'),
    path('speakers/<int:pk>/credentials/',         admin_views.speaker_credentials, name='speaker_credentials'),
    path('speakers/<int:speaker_pk>/talks/new/',   admin_views.talk_create,         name='talk_create'),
    path('speakers/talks/<int:pk>/delete/',        admin_views.talk_delete,         name='talk_delete'),
]
