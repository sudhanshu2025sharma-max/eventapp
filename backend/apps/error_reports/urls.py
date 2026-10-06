from django.urls import path
from . import views

urlpatterns = [
    # User endpoints
    path('submit/',                  views.submit_error_report,        name='api_submit_error_report'),
    path('my/',                      views.my_error_reports,           name='api_my_error_reports'),

    # Admin Mobile Ticket CRUD
    path('admin/list/',              views.admin_list_reports,         name='api_admin_list_error_reports'),
    path('admin/create/',            views.admin_create_report,        name='api_admin_create_error_report'),
    path('admin/<uuid:pk>/status/',  views.admin_update_report_status, name='api_admin_update_error_report_status'),
    path('admin/<uuid:pk>/delete/',  views.admin_delete_report,        name='api_admin_delete_error_report'),

    # Admin Mobile Logs & Health Diagnostics
    path('admin/logs/server/',       views.admin_server_logs,          name='api_admin_server_logs'),
    path('admin/logs/system/',       views.admin_system_logs,          name='api_admin_system_logs'),
    path('admin/logs/system/clear/', views.admin_clear_system_logs,    name='api_admin_clear_system_logs'),
    path('admin/health/',            views.admin_system_health,        name='api_admin_system_health'),
]
