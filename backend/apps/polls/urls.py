from django.urls import path
from . import views, ideathon_views

urlpatterns = [
    # Polls
    path('',                         views.poll_list,           name='poll_list'),
    path('<uuid:pk>/',               views.poll_detail,         name='poll_detail'),
    path('<uuid:pk>/vote/',          views.poll_vote,           name='poll_vote'),
    path('<uuid:pk>/my-vote/',       views.my_vote,             name='poll_my_vote'),
    path('admin/list/',              views.admin_poll_list,     name='poll_admin_list'),
    path('admin/<uuid:pk>/action/',  views.admin_poll_action,   name='poll_admin_action'),
    path('admin/<uuid:pk>/results/', views.admin_poll_results,  name='poll_admin_results'),
    path('admin/create/',            views.admin_poll_create,   name='poll_admin_create'),
    path('admin/ideathon/toggle/',   views.admin_ideathon_toggle, name='poll_admin_ideathon_toggle'),

    # Ideathon
    path('ideathon/',                                    ideathon_views.ideathon_info,    name='ideathon_info'),
    path('ideathon/check-name/',                         ideathon_views.check_team_name,  name='ideathon_check_name'),
    path('ideathon/create-team/',                        ideathon_views.create_team,      name='ideathon_create_team'),
    path('ideathon/leave-team/',                         ideathon_views.leave_team,       name='ideathon_leave_team'),
    path('ideathon/teams/<uuid:pk>/join/',               ideathon_views.join_team,        name='ideathon_join_team'),
    path('ideathon/teams/<uuid:pk>/invite/',             ideathon_views.invite_member,    name='ideathon_invite_member'),
    path('ideathon/teams/<uuid:pk>/update/',             ideathon_views.update_team,      name='ideathon_update_team'),
    path('ideathon/teams/<uuid:pk>/change-leader/',      ideathon_views.change_leader,    name='ideathon_change_leader'),
    path('ideathon/invites/<uuid:invite_id>/respond/',   ideathon_views.respond_invite,   name='ideathon_respond_invite'),
]
