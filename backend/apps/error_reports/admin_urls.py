from django.urls import path
from . import admin_views

urlpatterns = [
    path('error-reports/',                 admin_views.error_reports_dashboard,  name='panel_error_reports'),
    path('error-reports/<uuid:pk>/',       admin_views.error_report_detail,      name='panel_error_report_detail'),
    path('error-reports/live-log-stream/', admin_views.server_log_stream_ajax,   name='panel_live_log_stream'),
    path('error-reports/clear-sys-logs/',  admin_views.delete_system_logs,       name='panel_clear_system_logs'),
]
