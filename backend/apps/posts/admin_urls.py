from django.urls import path
from . import admin_views

urlpatterns = [
    path('feed/',                      admin_views.feed_panel,      name='feed_panel'),
    path('feed/new/',                  admin_views.feed_create,     name='feed_create'),
    path('feed/<uuid:pk>/edit/',       admin_views.feed_edit,       name='feed_edit'),
    path('feed/<uuid:pk>/delete/',     admin_views.feed_delete,     name='feed_delete'),
    path('feed/<uuid:pk>/pin/',        admin_views.feed_pin_toggle, name='feed_pin_toggle'),
    path('feed/<uuid:pk>/comments/',   admin_views.feed_comments,   name='feed_comments'),
]
