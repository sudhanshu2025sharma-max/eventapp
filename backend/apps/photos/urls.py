from django.urls import path
from . import views

urlpatterns = [
    # Participant
    path('gallery/',           views.gallery,              name='photo_gallery'),
    path('upload/',            views.upload,               name='photo_upload'),
    path('mine/',              views.my_photos,            name='photo_mine'),
    path('mine/<int:pk>/delete/', views.delete_my_photo,      name='photo_delete_mine'),
    path('sessions/',          views.sessions_with_photos, name='photo_sessions'),

    # Admin API
    path('admin/settings/',          views.admin_settings, name='photo_admin_settings'),
    path('admin/queue/',             views.admin_queue,    name='photo_admin_queue'),
    path('admin/<int:pk>/review/',   views.admin_review,   name='photo_admin_review'),
    path('admin/<int:pk>/delete/',   views.admin_delete,   name='photo_admin_delete'),
    path('admin/stats/',             views.admin_stats,    name='photo_admin_stats'),
    path('selfie-points/', views.selfie_points_list, name='selfie_points_list'),
    path('selfie-upload/', views.selfie_upload, name='selfie_upload'),
]
