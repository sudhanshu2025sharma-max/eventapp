import logging, requests, ssl
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
from django.utils import timezone
from django.conf import settings
from .models import DeviceToken, UserNotification

logger = logging.getLogger(__name__)
FCM_URL = 'https://fcm.googleapis.com/fcm/send'
EXPO_URL = 'https://exp.host/--/api/v2/push/send'

def _key(): return getattr(settings,'FCM_SERVER_KEY','')

def _target_users(t, role, user):
    from apps.accounts.models import User
    if t=='all': return User.objects.filter(is_active=True)
    if t=='role' and role: return User.objects.filter(is_active=True, role=role)
    if t=='user' and user: return User.objects.filter(pk=user.pk)
    return User.objects.none()

def _create_rows(notif, users):
    now=timezone.now()
    rows=[UserNotification(notification=notif,user=u,delivered=True,delivered_at=now) for u in users]
    UserNotification.objects.bulk_create(rows, ignore_conflicts=True)

def _cover_url(notif, request=None):
    if not notif.cover_image: return None
    try: return request.build_absolute_uri(notif.cover_image.url) if request else notif.cover_image.url
    except: return None

def _send_fcm(tokens,title,body,data,img=None):
    if not tokens: return 0,0,[]
    key=_key()
    if not key or 'your-fcm' in key or len(key)<20:
        logger.warning("FCM_SERVER_KEY placeholder -> skip FCM, in-app still works")
        return 0,0,[]
    payload={'registration_ids':tokens,'notification':{'title':title,'body':body},'data':data or {}}
    if img: payload['notification']['image']=img
    try:
        r=requests.post(FCM_URL,json=payload,headers={'Authorization':f'key={key}'},timeout=10).json()
        bad=[]
        for i,res in enumerate(r.get('results',[])):
            if res.get('error') in ('NotRegistered','InvalidRegistration'): bad.append(tokens[i])
        return r.get('success',0),r.get('failure',0),bad
    except Exception as e:
        logger.error(f"FCM err {e}"); return 0,len(tokens),[]

def _send_expo(tokens,title,body,data,img=None):
    if not tokens: return 0,0,[]
    msgs=[]
    for t in tokens:
        m={"to":t,"title":title,"body":body,"data":data or {},"sound":"default"}
        if (data or {}).get("type") in ("new_message", "connection_request"):
            m["channelId"] = "chat"
        if img:
            m["data"]["cover_image"]=img
        msgs.append(m)
    try:
        # IITD proxy with SSL verification disabled (proxy does SSL inspection)
        import os
        proxies = {
            'http':  'http://proxy21.iitd.ac.in:3128',
            'https': 'http://proxy21.iitd.ac.in:3128',
        }
        session = requests.Session()
        session.verify = False  # IITD proxy intercepts + re-encrypts
        r=session.post(EXPO_URL,json=msgs,headers={'Accept':'application/json','Content-Type':'application/json'},proxies=proxies,timeout=30).json()
        # Expo returns array of receipts
        success=sum(1 for x in r.get('data',r) if isinstance(x,dict) and x.get('status')=='ok') if isinstance(r,dict) else len(tokens)
        return success, len(tokens)-success, []
    except Exception as e:
        logger.error(f"Expo push err {e}"); return 0,len(tokens),[]

def _send_hybrid(tokens,title,body,data,img=None):
    expo=[t for t in tokens if t.startswith('ExponentPushToken')]
    fcm=[t for t in tokens if not t.startswith('ExponentPushToken')]
    s1,f1,b1=_send_expo(expo,title,body,data,img)
    s2,f2,b2=_send_fcm(fcm,title,body,data,img)
    return s1+s2, f1+f2, b1+b2

def send_to_all(title,body,data,notif,request=None):
    users=_target_users('all','',None); _create_rows(notif,users)
    tokens=list(DeviceToken.objects.filter(is_active=True,user__in=users).values_list('token',flat=True))
    return _send_hybrid(tokens,title,body,data,_cover_url(notif,request))

def send_to_role(role,title,body,data,notif,request=None):
    users=_target_users('role',role,None); _create_rows(notif,users)
    tokens=list(DeviceToken.objects.filter(is_active=True,user__in=users).values_list('token',flat=True))
    return _send_hybrid(tokens,title,body,data,_cover_url(notif,request))

def send_to_user(user,title,body,data,notif,request=None):
    users=_target_users('user','',user); _create_rows(notif,users)
    tokens=list(DeviceToken.objects.filter(is_active=True,user=user).values_list('token',flat=True))
    return _send_hybrid(tokens,title,body,data,_cover_url(notif,request))


# Public alias — used by checkins and schedule reminders
def send_to_tokens(tokens, title, body, data=None, img=None):
    return _send_hybrid(tokens, title, body, data or {}, img)
