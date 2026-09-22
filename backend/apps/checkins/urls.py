from django.urls import path
from . import views

urlpatterns = [
    path('my-qr/', views.my_qr, name='my_qr'),
    path('status/', views.checkin_status, name='checkin_status'),
    path('list/', views.checkin_list, name='checkin_list'),
    path('scan/', views.scan_checkin, name='scan_checkin'),
    path('confirm-goodies/', views.confirm_goodies, name='confirm_goodies'),
    path('participants/', views.checked_in_participants, name='checked_in_participants'),

    # Meal passes
    path('meal/status/', views.meal_status, name='meal_status'),
    path('meal/generate/', views.generate_meal_pass, name='generate_meal_pass'),
    path('meal/scan/', views.scan_meal, name='scan_meal'),
    path('meal/window/', views.meal_window_toggle, name='meal_window_toggle'),
    path('meal/push/', views.meal_push_notification, name='meal_push_notification'),
    path('meal/stats/', views.meal_stats, name='meal_stats'),
    path('meal/list/', views.meal_list, name='meal_list'),
    path('meal-pass/create/', views.create_meal_pass_api, name='create_meal_pass'),
    path('meal-pass/mine/', views.my_meal_passes, name='my_meal_passes'),

    # Network / Attendees
    path('network/', views.network_list, name='network_list'),
]
