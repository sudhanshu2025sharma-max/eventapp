from django.urls import path
from . import admin_views

urlpatterns = [
    path('checkins/scanner/', admin_views.scanner_view, name='checkin_scanner'),
    path('checkins/list/', admin_views.checkin_list_view, name='checkin_list'),
    path('checkins/scan/', admin_views.panel_scan, name='panel_scan'),
    path('checkins/goodies/', admin_views.panel_goodies, name='panel_goodies'),
    path('checkins/stats/', admin_views.panel_stats, name='panel_stats'),

    # Meal pass admin endpoints
    path('checkins/meal/scan/', admin_views.panel_meal_scan, name='panel_meal_scan'),
    path('checkins/meal/window/', admin_views.panel_meal_window_toggle, name='panel_meal_window_toggle'),
    path('checkins/meal/push/', admin_views.panel_meal_push, name='panel_meal_push'),
    path('checkins/meal-window-status/', admin_views.panel_meal_window_status, name='panel_meal_window_status'),
    path('checkins/meal-pass/', admin_views.meal_pass_create_view, name='meal_pass_create'),
]
