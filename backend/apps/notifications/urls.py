from django.urls import path
from . import views

urlpatterns = [
    # Root alias
    path('',                  views.my_notifications,    name='notifications_root'),

    # Token management (supporting both register-token and tokens endpoint)
    path('register-token/',   views.register_token,      name='register_token'),
    path('tokens/',           views.register_token,      name='register_token_alias'),
    path('unregister-token/', views.unregister_token,    name='unregister_token'),

    # Admin endpoints
    path('send/',             views.send_notification,    name='send_notification'),
    path('history/',          views.notification_history, name='notification_history'),
    path('<uuid:pk>/',        views.notification_detail,  name='notification_detail'),

    # App endpoints
    path('my/',               views.my_notifications,    name='my_notifications'),
    path('mark-read/',        views.mark_read,           name='mark_read'),
    path('mark-all-read/',    views.mark_all_read,       name='mark_all_read'),
    path('unread-count/',     views.unread_count,        name='unread_count'),
]
