from django.urls import path
from apps.accounts import admin_views
from apps.conferences import views as conf_views

urlpatterns = [
    # Auth
    path('',        admin_views.admin_dashboard, name='admin_dashboard'),
    path('login/',  admin_views.admin_login,     name='admin_login'),
    path('logout/', admin_views.admin_logout,    name='admin_logout'),

    # Participant import flow
    path('participants/',                   admin_views.participants_list,       name='participants_list'),
    path('participants/add/',               admin_views.participant_add,         name='participant_add'),
    path('participants/upload/',            admin_views.participants_upload,     name='participants_upload'),
    path('participants/preview/',           admin_views.participants_preview,    name='participants_preview'),
    path('participants/confirm/',           admin_views.participants_confirm,    name='participants_confirm'),
    path('participants/delete/<int:pk>/',   admin_views.participants_delete_row, name='participants_delete_row'),
    path('participants/edit/<uuid:pk>/',    admin_views.participant_edit,        name='participant_edit'),
    path('participants/remove/<uuid:pk>/',  admin_views.participant_delete,      name='participant_delete'),
    path('participants/template/',          admin_views.participants_template,   name='participants_template'),

    # User management (warn / suspend)
    path('users/manage/',                       admin_views.users_manage,      name='users_manage'),
    path('users/<uuid:pk>/warn/',               admin_views.user_warn,         name='user_warn'),
    path('users/<uuid:pk>/suspend/',            admin_views.user_suspend,      name='user_suspend'),
    path('users/<uuid:pk>/unsuspend/',          admin_views.user_unsuspend,    name='user_unsuspend'),
    path('users/<uuid:pk>/clear-warning/',      admin_views.user_clear_warning,name='user_clear_warning'),

    # Forgot password (public)
    path('password-reset/',                          admin_views.password_reset_request, name='password_reset_request'),
    path('password-reset-confirm/<uidb64>/<token>/', admin_views.password_reset_confirm, name='password_reset_confirm'),

    # Conference settings
    path('settings/conference/', conf_views.conference_settings_view, name='conference_settings'),

    # Events / Schedule
    path('events/',                     conf_views.events_admin,  name='events_admin'),
    path('events/create/',              conf_views.event_create,  name='event_create'),
    path('events/<int:pk>/edit/',       conf_views.event_edit,    name='event_edit'),
    path('events/<int:pk>/delete/',     conf_views.event_delete,  name='event_delete'),
]

# Staff Permissions panel
urlpatterns += [
    path('staff/permissions/', admin_views.staff_permissions_panel, name='staff_permissions_panel'),
]
