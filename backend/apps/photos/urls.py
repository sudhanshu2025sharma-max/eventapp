from django.urls import path
from . import views

urlpatterns = [
    # Root alias
    path('',                      views.gallery,              name='photo_root'),

    # Participant Gallery
    path('gallery/',              views.gallery,              name='photo_gallery'),
    path('upload/',               views.upload,               name='photo_upload'),
    path('mine/',                 views.my_photos,            name='photo_mine'),
    path('mine/<int:pk>/delete/', views.delete_my_photo,      name='photo_delete_mine'),
    path('sessions/',             views.sessions_with_photos, name='photo_sessions'),

    # Admin API
    path('admin/settings/',       views.admin_settings,       name='photo_admin_settings'),
    path('admin/queue/',          views.admin_queue,          name='photo_admin_queue'),
    path('admin/<int:pk>/review/',views.admin_review,         name='photo_admin_review'),
    path('admin/<int:pk>/delete/',views.admin_delete,         name='photo_admin_delete'),
    path('admin/stats/',          views.admin_stats,          name='photo_admin_stats'),

    # Participant Checkpoints
    path('checkpoints/',          views.selfie_points_list,   name='checkpoints_list'),
    path('checkpoint-visit/',     views.selfie_upload,        name='checkpoint_visit'),
    path('selfie-points/',        views.selfie_points_list,   name='selfie_points_list'),
    path('selfie-upload/',        views.selfie_upload,        name='selfie_upload'),

    # Mobile Admin Checkpoints CRUD
    path('admin/checkpoints/',           views.admin_checkpoints_list_create, name='admin_checkpoints_list_create'),
    path('admin/checkpoints/<int:pk>/toggle/', views.admin_checkpoint_toggle,       name='admin_checkpoint_toggle'),
    path('admin/checkpoints/<int:pk>/delete/', views.admin_checkpoint_delete,       name='admin_checkpoint_delete'),
    path('admin/sponsors-flat/',         views.admin_sponsors_flat,           name='admin_sponsors_flat'),
]
