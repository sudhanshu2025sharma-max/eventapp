from django.urls import path
from . import admin_views

urlpatterns = [
    path('certificates/', admin_views.certificates_dashboard, name='panel_certificates'),
    path('certificates/template/new/', admin_views.template_form, name='panel_cert_new'),
    path('certificates/template/<int:pk>/edit/', admin_views.template_form, name='panel_cert_edit'),
    path('certificates/settings/', admin_views.settings_view, name='panel_cert_settings'),
    path('certificates/issue/', admin_views.issue_certificates, name='panel_cert_issue'),
    path('certificates/batch/<int:job_id>/status/', admin_views.batch_status, name='panel_cert_batch_status'),
    path('certificates/reissue/<int:pk>/', admin_views.reissue_certificate, name='panel_cert_reissue'),
    path('certificates/delete/<int:pk>/', admin_views.delete_certificate, name='panel_cert_delete'),
    path('certificates/search-users/', admin_views.search_users, name='panel_cert_search_users'),
    path('certificates/download-csv-template/', admin_views.download_csv_template, name='panel_cert_download_csv_template'),
]
