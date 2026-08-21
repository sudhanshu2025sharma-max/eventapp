from django.urls import path
from . import admin_views

urlpatterns = [
    path('chat/',                                     admin_views.chat_panel,          name='chat_panel'),
    path('chat/<uuid:conversation_id>/',              admin_views.chat_thread,         name='chat_thread'),
    path('chat/requests/',                            admin_views.chat_requests_panel, name='chat_requests_panel'),
    path('chat/reports/',                             admin_views.chat_reports_panel,  name='chat_reports_panel'),
    path('chat/reports/<uuid:report_id>/action/',     admin_views.chat_report_action,  name='chat_report_action'),
    path('chat/analytics/',                           admin_views.chat_analytics,      name='chat_analytics'),
    path('chat/shakes/',                               admin_views.chat_shakes_panel,   name='chat_shakes_panel'),
    path('chat/export/',                              admin_views.chat_export,         name='chat_export'),
]
