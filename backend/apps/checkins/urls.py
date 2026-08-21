from django.urls import path
from . import views

urlpatterns = [
    path('scan/',          views.scan_checkin,       name='checkin_scan'),
    path('goodies/',       views.confirm_goodies,    name='checkin_goodies'),
    path('status/',        views.checkin_status,     name='checkin_status'),
    path('list/',          views.checkin_list,        name='checkin_list'),
    path('my-qr/',         views.my_qr,              name='checkin_my_qr'),
    path('network/',       views.network_list,        name='checkin_network'),

    path('meal/status/',   views.meal_status,         name='meal_status'),
    path('meal/generate/', views.generate_meal_pass,  name='meal_generate'),
    path('meal/scan/',     views.scan_meal,            name='meal_scan'),
    path('meal/window/',   views.meal_window_toggle,   name='meal_window'),
    path('meal/stats/',    views.meal_stats,           name='meal_stats'),
    path('meal/list/',     views.meal_list,            name='meal_list'),
    path('checked-in/', views.checked_in_participants, name='checked_in_participants'),
]