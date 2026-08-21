from django.urls import path
from . import views

urlpatterns = [
    # Connection requests
    path('requests/send/',                              views.send_request,      name='chat_send_request'),
    path('requests/inbox/',                             views.inbox,             name='chat_inbox'),
    path('requests/sent/',                              views.sent_requests,     name='chat_sent_requests'),
    path('requests/<uuid:request_id>/respond/',         views.respond_request,   name='chat_respond_request'),
    path('requests/<uuid:request_id>/withdraw/',        views.withdraw_request,  name='chat_withdraw_request'),
    path('requests/count/',                             views.request_counts,    name='chat_request_counts'),

    # Connection check — single + bulk
    path('check/bulk/',                                 views.bulk_connection_check, name='chat_bulk_check'),
    path('check/<uuid:user_id>/',                       views.check_connection,      name='chat_check_connection'),
    path('connections/count/',                          views.connection_count,      name='chat_connection_count'),

    # Conversations
    path('conversations/',                              views.conversation_list,   name='chat_conversation_list'),
    path('conversations/<uuid:conversation_id>/',       views.conversation_detail, name='chat_conversation_detail'),
    path('conversations/<uuid:conversation_id>/mute/',  views.toggle_mute,         name='chat_toggle_mute'),

    # Messages
    path('conversations/<uuid:conversation_id>/messages/',      views.message_list,       name='chat_message_list'),
    path('conversations/<uuid:conversation_id>/messages/send/', views.send_message,       name='chat_send_message'),
    path('conversations/<uuid:conversation_id>/messages/read/', views.mark_messages_read, name='chat_mark_read'),
    path('conversations/<uuid:conversation_id>/messages/<uuid:message_id>/delete/', views.delete_message,  name='chat_delete_message'),
    path('conversations/<uuid:conversation_id>/messages/<uuid:message_id>/react/',  views.toggle_reaction, name='chat_toggle_reaction'),
    path('conversations/<uuid:conversation_id>/messages/<uuid:message_id>/report/', views.report_message,  name='chat_report_message'),

    # Shake to Connect
    path('shake/', views.shake_connect, name='chat_shake_connect'),

    # Block
    path('disconnect/', views.disconnect_user, name='chat_disconnect'),
    path('block/',    views.block_user,   name='chat_block_user'),
    path('unblock/',  views.unblock_user, name='chat_unblock_user'),
    path('blocked/',  views.blocked_list, name='chat_blocked_list'),
]
