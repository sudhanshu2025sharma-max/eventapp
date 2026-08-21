from django.urls import path
from . import admin_views

urlpatterns = [
    path('photos/', admin_views.photos_panel, name='photos_panel'),
    path('selfie-points/', admin_views.selfie_points_panel, name='selfie_points_panel'),
]
