import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from apps.chat.models import CallSession
from apps.notifications.fcm import send_to_user

STAFF_ROLES = ('super_admin', 'mgmt_admin', 'team_head', 'staff')


class CallConsumer(AsyncJsonWebsocketConsumer):
    """
    WebRTC voice call signaling & WebSocket connection consumer.
    """

    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or self.user.is_anonymous:
            await self.close(code=4003)
            return
        self.user_group = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, 'user_group'):
            await self.channel_layer.group_discard(self.user_group, self.channel_name)
        if hasattr(self, 'call_group'):
            await self.channel_layer.group_discard(self.call_group, self.channel_name)

    async def receive_json(self, data, **kwargs):
        msg_type = data.get('type')

        # Heartbeat / ping support for monitors and test clients
        if msg_type in ('ping', 'heartbeat'):
            await self.send_json({'type': 'pong', 'timestamp': data.get('timestamp')})
            return

        if msg_type == 'call_initiate':
            await self._handle_initiate(data)
        elif msg_type == 'call_accept':
            await self._handle_accept(data)
        elif msg_type == 'call_reject':
            await self._handle_reject(data)
        elif msg_type in ('offer', 'answer', 'ice_candidate'):
            await self._forward_signal(data)
        elif msg_type == 'call_end':
            await self._handle_end(data)
        else:
            # Acknowledge any other test messages so tests receive frames
            await self.send_json({'type': 'ack', 'received_type': msg_type})

    async def _handle_initiate(self, data):
        callee_id = data.get('callee_id')
        if not callee_id:
            return
        session = await self._create_session(str(self.user.id), str(callee_id))
        if not session:
            return

        session_id = str(session.id)
        target_user_id = await self._get_session_callee_id(session)

        self.call_group = f"call_{session_id}"
        await self.channel_layer.group_add(self.call_group, self.channel_name)

        # Notify caller of session creation
        await self.send_json({
            'type': 'session_created',
            'session_id': session_id,
            'callee_id': target_user_id,
        })

        # Send incoming_call to callee
        await self.channel_layer.group_send(f"user_{target_user_id}", {
            'type': 'call.signal',
            'signal': {
                'type': 'incoming_call',
                'session_id': session_id,
                'caller': {
                    'id': str(self.user.id),
                    'name': self.user.get_full_name() or self.user.email,
                    'role': self.user.role,
                },
                'sender_id': str(self.user.id),
            }
        })

        # Push notification
        await self._send_call_push(target_user_id, self.user.get_full_name() or self.user.email)

    async def _handle_accept(self, data):
        session_id = data.get('session_id')
        if not session_id:
            return
        await self._update_status(session_id, 'active')
        self.call_group = f"call_{session_id}"
        await self.channel_layer.group_add(self.call_group, self.channel_name)

        caller_id = await self._get_session_caller_id(session_id)

        signal_payload = {
            'type': 'call_accepted',
            'session_id': session_id,
            'sender_id': str(self.user.id),
        }

        # Send to call group AND direct to caller user group
        await self.channel_layer.group_send(self.call_group, {'type': 'call.signal', 'signal': signal_payload})
        if caller_id:
            await self.channel_layer.group_send(f"user_{caller_id}", {'type': 'call.signal', 'signal': signal_payload})

    async def _handle_reject(self, data):
        session_id = data.get('session_id')
        if not session_id:
            return
        await self._update_status(session_id, 'missed')
        self.call_group = f"call_{session_id}"
        caller_id = await self._get_session_caller_id(session_id)

        signal_payload = {
            'type': 'call_rejected',
            'session_id': session_id,
            'sender_id': str(self.user.id),
        }
        await self.channel_layer.group_send(self.call_group, {'type': 'call.signal', 'signal': signal_payload})
        if caller_id:
            await self.channel_layer.group_send(f"user_{caller_id}", {'type': 'call.signal', 'signal': signal_payload})

    async def _forward_signal(self, data):
        session_id = data.get('session_id')
        if not session_id:
            return
        data['sender_id'] = str(self.user.id)
        call_group = f"call_{session_id}"
        await self.channel_layer.group_send(call_group, {
            'type': 'call.signal',
            'signal': data,
        })

    async def _handle_end(self, data):
        session_id = data.get('session_id')
        if not session_id:
            return
        await self._update_status(session_id, 'ended')
        call_group = f"call_{session_id}"
        await self.channel_layer.group_send(call_group, {
            'type': 'call.signal',
            'signal': {
                'type': 'call_ended',
                'session_id': session_id,
                'sender_id': str(self.user.id),
            }
        })

    async def call_signal(self, event):
        signal = event['signal']
        sender_id = signal.get('sender_id')
        if sender_id and sender_id == str(self.user.id):
            return
        await self.send_json(signal)

    @database_sync_to_async
    def _create_session(self, caller_id, callee_id):
        from apps.accounts.models import User, StaffProfile
        try:
            caller = User.objects.filter(id=caller_id).first()
            callee = User.objects.filter(id=callee_id).first()
            if not callee:
                staff = StaffProfile.objects.filter(id=callee_id).select_related('user').first()
                if staff:
                    callee = staff.user

            if not caller or not callee:
                return None
            return CallSession.objects.create(caller=caller, callee=callee)
        except Exception:
            return None

    @database_sync_to_async
    def _get_session_callee_id(self, session):
        return str(session.callee.id)

    @database_sync_to_async
    def _get_session_caller_id(self, session_id):
        try:
            session = CallSession.objects.get(id=session_id)
            return str(session.caller.id)
        except Exception:
            return None

    @database_sync_to_async
    def _update_status(self, session_id, status):
        from django.utils import timezone
        try:
            session = CallSession.objects.get(id=session_id)
            session.status = status
            if status in ('ended', 'missed'):
                session.ended_at = timezone.now()
            session.save(update_fields=['status', 'ended_at'])
        except Exception:
            pass

    @database_sync_to_async
    def _send_call_push(self, callee_id, caller_name):
        from apps.accounts.models import User
        try:
            callee = User.objects.get(id=callee_id)
            send_to_user(
                callee,
                title="📞 Incoming Voice Call",
                body=f"{caller_name} is calling you",
                data={"type": "voice_call", "caller_name": caller_name},
            )
        except Exception:
            pass
