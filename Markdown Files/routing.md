## ✅ Connection Confirmed — `HTTP Status: 405`

**405 = "Method Not Allowed"** — This is a **SUCCESS** response! It means:
- Website VM (`10.17.5.38`) successfully reached App VM (`10.17.9.48:8000`)
- Django received the request and replied: *"I only accept POST on /login/, not GET"*
- The internal network path between both VMs is **open and working**

---

## 📄 Complete `wordpress.conf`

Run this on your **Website VM (`10.17.5.38`)**:

```bash
# Step 1: Enable required Apache modules (safe, one-time)
sudo a2enmod proxy proxy_http proxy_wstunnel headers rewrite

# Step 2: Write the complete config
sudo cat << 'CONF' > /etc/apache2/sites-available/wordpress.conf
<VirtualHost *:80>
    ServerName etd2026.iitd.ac.in
    ServerAlias www.etd2026.iitd.ac.in

    DocumentRoot /var/www/html

    # ── WordPress Directory (unchanged) ──
    <Directory /var/www/html>
        Options FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # ══════════════════════════════════════════════════════════
    #  REVERSE PROXY → App VM (10.17.9.48:8000)
    # ══════════════════════════════════════════════════════════

    # Keep the original Host header so Django sees "etd2026.iitd.ac.in"
    ProxyPreserveHost On

    # Max time to wait for App VM response (Gunicorn timeout is 120s)
    ProxyTimeout 120

    # Max upload size: 50MB (for participant CSV, photo submissions)
    LimitRequestBody 52428800

    # Tell Django the original request came via HTTPS
    # (IITD Gateway strips SSL, so Apache sees plain HTTP,
    #  but the user's browser is actually on HTTPS)
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port "443"

    # ── 1. WebSockets (Voice Calls, Real-time Chat) ──
    # Must be listed BEFORE /api/ because Apache matches top-to-bottom
    ProxyPass /ws/ ws://10.17.9.48:8000/ws/
    ProxyPassReverse /ws/ ws://10.17.9.48:8000/ws/

    # ── 2. REST API (Mobile App endpoints) ──
    ProxyPass /api/ http://10.17.9.48:8000/api/
    ProxyPassReverse /api/ http://10.17.9.48:8000/api/

    # ── 3. Web Admin Panel ──
    ProxyPass /panel/ http://10.17.9.48:8000/panel/
    ProxyPassReverse /panel/ http://10.17.9.48:8000/panel/

    # ── 4. Uploaded Media (User photos, QR passes, avatars) ──
    ProxyPass /media/ http://10.17.9.48:8000/media/
    ProxyPassReverse /media/ http://10.17.9.48:8000/media/

    # ── 5. Admin Panel Static Files (CSS, JS, images) ──
    ProxyPass /static/panel/ http://10.17.9.48:8000/static/panel/
    ProxyPassReverse /static/panel/ http://10.17.9.48:8000/static/panel/

    # ── Logging ──
    ErrorLog ${APACHE_LOG_DIR}/wordpress_error.log
    CustomLog ${APACHE_LOG_DIR}/wordpress_access.log combined
</VirtualHost>
CONF

# Step 3: Verify syntax (will NOT touch live site if there's an error)
sudo apache2ctl configtest

# Step 4: Reload Apache (zero downtime — live WordPress stays up)
sudo systemctl reload apache2
```

---

## 🧠 How It Works — Line by Line Explanation

### The Big Picture

```
User's Phone / Laptop
    │
    │  Requests: https://etd2026.iitd.ac.in/api/v1/auth/login/
    ▼
┌─────────────────────────────────────────────┐
│  IITD Central Gateway (CSC)                 │
│  • Decrypts HTTPS → converts to HTTP        │
│  • Forwards to your Website VM on Port 80   │
└──────────────────┬──────────────────────────┘
                   │  HTTP (Port 80)
                   ▼
┌─────────────────────────────────────────────┐
│  Website VM (10.17.5.38) — Apache           │
│                                             │
│  Apache reads the URL path:                 │
│                                             │
│  /about/        → Serve WordPress files     │
│  /wp-admin/     → Serve WordPress files     │
│  /api/...       → FORWARD to 10.17.9.48     │
│  /panel/...     → FORWARD to 10.17.9.48     │
│  /media/...     → FORWARD to 10.17.9.48     │
│  /ws/...        → FORWARD to 10.17.9.48     │
│  /static/panel/ → FORWARD to 10.17.9.48     │
└──────────────────┬──────────────────────────┘
                   │  HTTP (Port 8000, internal LAN)
                   ▼
┌─────────────────────────────────────────────┐
│  App VM (10.17.9.48) — Gunicorn + Django    │
│  • Handles API, Admin, Media, WebSockets    │
│  • Talks to PostgreSQL + Redis              │
└─────────────────────────────────────────────┘
```

### Key Directives Explained

| Directive | What It Does | Why We Need It |
|---|---|---|
| `ProxyPreserveHost On` | Passes the original `Host: etd2026.iitd.ac.in` header to Django | Without this, Django sees `Host: 10.17.9.48` and rejects the request (not in ALLOWED_HOSTS) |
| `ProxyTimeout 120` | Waits up to 120 seconds for App VM to respond | Matches Gunicorn's `--timeout 120`. Large CSV uploads or slow DB queries need this |
| `LimitRequestBody 52428800` | Allows uploads up to 50MB | Participant CSV upload, photo submissions, selfie points |
| `RequestHeader set X-Forwarded-Proto "https"` | Tells Django "the user is on HTTPS" even though Apache sees HTTP | IITD Gateway strips SSL. Without this, Django generates `http://` redirect URLs causing infinite loops |
| `ProxyPass /api/ http://10.17.9.48:8000/api/` | "Any URL starting with `/api/` → send to App VM" | Routes mobile app traffic to Django |
| `ProxyPassReverse /api/ http://10.17.9.48:8000/api/` | Rewrites redirect URLs in Django's response back to the public domain | If Django returns a 302 redirect to `http://10.17.9.48:8000/api/...`, Apache rewrites it to `https://etd2026.iitd.ac.in/api/...` so the user's browser can follow it |
| `ProxyPass /ws/ ws://...` | WebSocket protocol forwarding | Voice calls and real-time chat use WebSockets, not regular HTTP. The `ws://` protocol keeps the connection open permanently |

### Why WordPress Is NOT Affected

Apache processes `ProxyPass` rules **only for matching URL prefixes**:

```
Request: /about-us/
  → Does it start with /ws/?      No
  → Does it start with /api/?     No
  → Does it start with /panel/?   No
  → Does it start with /media/?   No
  → Does it start with /static/panel/? No
  → Falls through to DocumentRoot /var/www/html → WordPress serves it ✅

Request: /api/v1/auth/login/
  → Does it start with /api/?     YES → Forward to 10.17.9.48:8000 ✅
```

WordPress URLs (`/`, `/about/`, `/wp-admin/`, `/wp-content/`) **never match** any ProxyPass rule, so they continue working exactly as before.

---

## ⚙️ Required Django Settings on App VM (`10.17.9.48`)

On the **App VM**, update `/home/baadalvm/eventapp/backend/confhub/settings.py`:

```python
ALLOWED_HOSTS = [
    'etd2026.iitd.ac.in',
    'www.etd2026.iitd.ac.in',
    '10.17.9.48',
    '127.0.0.1',
    'localhost',
]

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

CSRF_TRUSTED_ORIGINS = [
    'https://etd2026.iitd.ac.in',
    'http://etd2026.iitd.ac.in',
    'http://10.17.9.48:8000',
    'http://localhost:8000',
]
```

Then restart Gunicorn:
```bash
cd /home/baadalvm/eventapp/backend
pkill -f gunicorn || true
sleep 1.5
nohup ./start_server.sh > server.log 2>&1 &
```

---

## 🧪 After Setup — Verification Tests

```bash
# From your laptop (outside IITD network):
curl -I https://etd2026.iitd.ac.in/panel/login/    # Should return 200
curl -I https://etd2026.iitd.ac.in/api/v1/auth/login/  # Should return 200 or 405

# WordPress should still work:
curl -I https://etd2026.iitd.ac.in/                 # Should return 200 (WordPress)
```

---

## 🔄 Emergency Rollback (If Anything Goes Wrong)

If the proxy breaks something, restore the original config in 10 seconds:

```bash
# On Website VM (10.17.5.38):
sudo cat << 'EOF' > /etc/apache2/sites-available/wordpress.conf
<VirtualHost *:80>
    ServerName etd2026.iitd.ac.in
    ServerAlias www.etd2026.iitd.ac.in
    DocumentRoot /var/www/html
    <Directory /var/www/html>
        Options FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    ErrorLog ${APACHE_LOG_DIR}/wordpress_error.log
    CustomLog ${APACHE_LOG_DIR}/wordpress_access.log combined
</VirtualHost>
EOF
sudo systemctl reload apache2
```

This instantly removes all proxy rules and WordPress goes back to normal. **Zero risk.**