from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('login/',                   views.login_view,              name='api_login'),
    path('me/',                      views.me_view,                 name='api_me'),
    path('change-password/',         views.change_password_view,    name='api_change_password'),
    path('update-profile/',          views.update_profile_view,     name='api_update_profile'),
    path('logout/',                  views.logout_view,             name='api_logout'),
    path('token/refresh/',           TokenRefreshView.as_view(),    name='token_refresh'),
    path('users/',                   views.user_list_view,          name='user_list'),
    path('users/<uuid:pk>/action/',  views.user_action_view,        name='user_action'),
    path('participants/create/',     views.participant_create_view, name='participant_create'),
    path('discover/',                views.discover_view,           name='api_discover'),
    path('my-recap/',                views.my_recap_view,           name='api_my_recap'),
]
