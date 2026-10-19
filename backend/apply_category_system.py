import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

# ── 1. Update apps/accounts/admin_views.py ──
with open("apps/accounts/admin_views.py", "r") as f:
    av_code = f.read()

# Update participants_list view
old_list_fn = """@login_required(login_url='/panel/login/')
@module_required('participants')
def participants_list(request):
    from apps.checkins.models import CheckIn
    search = request.GET.get('search', '').strip()
    status_filter = request.GET.get('status', '').strip()

    qs = User.objects.exclude(role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff', 'speaker']).order_by('first_name', 'last_name')"""

new_list_fn = """@login_required(login_url='/panel/login/')
@module_required('participants')
def participants_list(request):
    from apps.checkins.models import CheckIn
    from django.db.models import Count, Q

    search = request.GET.get('search', '').strip()
    status_filter = request.GET.get('status', '').strip()
    selected_category = request.GET.get('category', '').strip()

    # Handle Add Category from Participants List Page
    if request.method == 'POST' and request.POST.get('action') == 'add_category':
        new_cat = request.POST.get('new_category_name', '').strip()
        if new_cat:
            messages.success(request, f"New category '{new_cat}' created successfully!")
            return redirect(f"/panel/participants/?category={new_cat}")

    base_qs = User.objects.exclude(role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff', 'speaker'])

    # Category stats & counts
    raw_cats = list(base_qs.values('category').annotate(count=Count('id')))
    category_counts = {}
    total_participants = 0
    for item in raw_cats:
        cname = (item['category'] or '').strip() or 'Participant'
        category_counts[cname] = category_counts.get(cname, 0) + item['count']
        total_participants += item['count']

    # Default suggested categories if 0
    for dc in ['Participant', 'Sponsor Delegate', 'Invited Guest', 'Keynote Speaker', 'VIP Guest']:
        if dc not in category_counts:
            category_counts[dc] = 0

    qs = base_qs.order_by('first_name', 'last_name')

    if selected_category:
        if selected_category == 'Participant':
            qs = qs.filter(Q(category__iexact='Participant') | Q(category='') | Q(category__isnull=True))
        else:
            qs = qs.filter(category__iexact=selected_category)"""

if old_list_fn in av_code:
    av_code = av_code.replace(old_list_fn, new_list_fn)

# Replace render context for participants_list
old_render_ctx = """    return render(request, 'panel/participants_list.html', {
        'participants': page_obj,
        'total': total,"""

new_render_ctx = """    return render(request, 'panel/participants_list.html', {
        'participants': page_obj,
        'total': total,
        'selected_category': selected_category,
        'category_counts': category_counts,
        'total_participants': total_participants,"""

if old_render_ctx in av_code:
    av_code = av_code.replace(old_render_ctx, new_render_ctx)


# Update participants_upload view
old_upload_fn = """@login_required(login_url='/panel/login/')
@module_required('participants')
def participants_upload(request):
    if request.method == 'POST':"""

new_upload_fn = """@login_required(login_url='/panel/login/')
@module_required('participants')
def participants_upload(request):
    if request.method == 'POST':
        if request.POST.get('action') == 'add_category':
            new_cat = request.POST.get('new_category_name', '').strip()
            if new_cat:
                messages.success(request, f"New category '{new_cat}' registered!")
            return redirect('participants_upload')"""

if old_upload_fn in av_code:
    av_code = av_code.replace(old_upload_fn, new_upload_fn)


old_upload_render = """    return render(request, 'panel/participants_upload.html', {'categories': all_cats})"""
new_upload_render = """    from django.db.models import Count
    base_qs = User.objects.exclude(role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff', 'speaker'])
    raw_cats = list(base_qs.values('category').annotate(count=Count('id')))
    cat_counts = {}
    for item in raw_cats:
        cname = (item['category'] or '').strip() or 'Participant'
        cat_counts[cname] = cat_counts.get(cname, 0) + item['count']

    for dc in ['Participant', 'Sponsor Delegate', 'Invited Guest', 'Keynote Speaker', 'VIP Guest']:
        if dc not in cat_counts:
            cat_counts[dc] = 0

    return render(request, 'panel/participants_upload.html', {
        'category_stats': cat_counts,
        'categories': sorted(list(cat_counts.keys()))
    })"""

if old_upload_render in av_code:
    av_code = av_code.replace(old_upload_render, new_upload_render)

with open("apps/accounts/admin_views.py", "w") as f:
    f.write(av_code)

print("1. Updated apps/accounts/admin_views.py")


# ── 2. Update templates/panel/participants_list.html ──
with open("templates/panel/participants_list.html", "r") as f:
    plist = f.read()

# Add Category Action Button to the top bar
old_actions = """  <a href="{% url 'participant_add' %}" class="btn btn-primary">
    <i class="fas fa-user-plus"></i> Add Single
  </a>"""

new_actions = """  <button type="button" onclick="document.getElementById('add-cat-modal').style.display='flex';" class="btn btn-secondary" style="background:#4f46e5;color:#fff;border-color:#4f46e5;">
    <i class="fas fa-folder-plus"></i> Add Category
  </button>
  <a href="{% url 'participant_add' %}" class="btn btn-primary">
    <i class="fas fa-user-plus"></i> Add Single
  </a>"""

if old_actions in plist:
    plist = plist.replace(old_actions, new_actions)

# Insert Category Filter Pills right above the table card
cat_pills_html = """<!-- Category Filter Tabs with Counts -->
<div style="margin-bottom:20px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:var(--surface);padding:12px;border-radius:12px;border:1px solid var(--border);">
  <span style="font-size:12px;font-weight:800;color:var(--text-tertiary);letter-spacing:0.5px;margin-right:6px;">CATEGORIES:</span>
  <a href="{% url 'participants_list' %}" class="btn btn-sm {% if not selected_category %}btn-primary{% else %}btn-secondary{% endif %}" style="border-radius:20px;padding:5px 14px;font-size:12px;font-weight:700;">
    All ({{ total_participants|default:total }})
  </a>
  {% for cname, count in category_counts.items %}
    <a href="{% url 'participants_list' %}?category={{ cname }}" class="btn btn-sm {% if selected_category == cname %}btn-primary{% else %}btn-secondary{% endif %}" style="border-radius:20px;padding:5px 14px;font-size:12px;font-weight:700;">
      {{ cname }} ({{ count }})
    </a>
  {% endfor %}
</div>

<!-- Modal for Adding Category -->
<div id="add-cat-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999;align-items:center;justify-content:center;">
  <div style="background:#fff;border-radius:16px;padding:24px;width:100%;max-width:420px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
    <h3 style="margin-top:0;margin-bottom:8px;font-size:18px;">Create Custom Category</h3>
    <p style="font-size:13px;color:var(--text-tertiary);margin-bottom:16px;">Add a new category (e.g., Sponsor Delegate, Media Press, VIP Guest) to group participants during single add or bulk CSV import.</p>
    <form method="post">
      {% csrf_token %}
      <input type="hidden" name="action" value="add_category">
      <label class="form-label" style="font-weight:700;">Category Name *</label>
      <input type="text" name="new_category_name" required placeholder="e.g. Sponsor Delegate" class="form-control" style="margin-bottom:20px;">
      <div style="display:flex;justify-content:flex-end;gap:10px;">
        <button type="button" onclick="document.getElementById('add-cat-modal').style.display='none';" class="btn btn-secondary">Cancel</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-check"></i> Create Category</button>
      </div>
    </form>
  </div>
</div>"""

if "<!-- Category Filter Tabs with Counts -->" not in plist:
    plist = plist.replace('<div class="card">', cat_pills_html + '\n<div class="card">', 1)

with open("templates/panel/participants_list.html", "w") as f:
    f.write(plist)

print("2. Updated templates/panel/participants_list.html")


# ── 3. Update templates/panel/participants_upload.html ──
upload_html = """{% extends "panel/base.html" %}
{% block title %}Import Participants — ETD 2026{% endblock %}
{% block page_title %}Import Participants{% endblock %}
{% block page_subtitle %}Upload CSV or Excel file to create user accounts in bulk{% endblock %}

{% block content %}
{% if messages %}
  {% for m in messages %}
    <div class="alert {% if 'error' in m.tags %}alert-error{% elif 'warning' in m.tags %}alert-warning{% else %}alert-success{% endif %}">
      <i class="fas {% if 'error' in m.tags %}fa-circle-xmark{% elif 'warning' in m.tags %}fa-triangle-exclamation{% else %}fa-circle-check{% endif %}"></i>
      {{ m }}
    </div>
  {% endfor %}
{% endif %}

<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:1080px;">
  <!-- Upload Card -->
  <div class="card">
    <div class="card-header">
      <h3>Upload File</h3>
      <a href="{% url 'participants_template' %}" class="card-header-action">
        <i class="fas fa-download"></i> Download Template
      </a>
    </div>
    <div class="card-body">
      <form method="post" enctype="multipart/form-data">
        {% csrf_token %}
        
        <div style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <label class="form-label" style="font-weight:700;margin:0;">Target Category for this Upload</label>
            <button type="button" onclick="document.getElementById('new-cat-modal').style.display='flex';" class="btn btn-sm btn-secondary" style="font-size:11px;padding:2px 8px;background:#4f46e5;color:#fff;border-color:#4f46e5;">
              <i class="fas fa-plus"></i> Add New Category
            </button>
          </div>
          <select name="default_category" class="form-control" style="font-weight:600;color:var(--primary);">
            {% for cat in categories %}
              <option value="{{ cat }}">{{ cat }}</option>
            {% endfor %}
          </select>
          <span style="font-size:12px;color:var(--text-tertiary);margin-top:4px;display:block;">
            Applies to rows that do not explicitly specify a <code>Category</code> column in the CSV.
          </span>
        </div>

        <div style="margin-bottom:20px;">
          <label class="form-label">Select CSV or Excel file</label>
          <div id="drop-zone" style="border:2px dashed var(--border);border-radius:12px;padding:32px 20px;text-align:center;cursor:pointer;transition:all 0.2s;background:var(--bg);position:relative;"
               onclick="document.getElementById('file-input').click();">
            <i class="fas fa-cloud-arrow-up" style="font-size:36px;color:var(--text-tertiary);display:block;margin-bottom:12px;"></i>
            <p style="font-size:14px;color:var(--text-secondary);margin-bottom:4px;font-weight:600;">
              Click to browse or drag &amp; drop
            </p>
            <p style="font-size:12px;color:var(--text-tertiary);">Supports .csv and .xlsx</p>
            <p id="file-name" style="font-size:13px;color:var(--primary);font-weight:600;margin-top:8px;"></p>
          </div>
          <input type="file" id="file-input" name="csv_file" accept=".csv,.xlsx" required
                 style="display:none;"
                 onchange="var n=this.files[0]?.name||'';document.getElementById('file-name').textContent=n;if(n){document.getElementById('drop-zone').style.borderColor='var(--primary)';document.getElementById('drop-zone').style.background='var(--primary-light)';}">
        </div>

        <button type="submit" class="btn btn-primary" style="width:100%;">
          <i class="fas fa-upload"></i> Upload &amp; Preview
        </button>
      </form>
    </div>
  </div>

  <!-- Available Categories & Instructions Column -->
  <div>
    <!-- Available Categories Card -->
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
        <h3>🏷️ Active User Categories</h3>
        <button type="button" onclick="document.getElementById('new-cat-modal').style.display='flex';" class="btn btn-sm btn-primary" style="font-size:12px;">
          <i class="fas fa-plus"></i> New Category
        </button>
      </div>
      <div class="card-body">
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          {% for cname, count in category_stats.items %}
            <div style="background:var(--surface);border:1px solid var(--border);padding:6px 12px;border-radius:8px;display:flex;align-items:center;gap:8px;font-size:13px;">
              <span style="font-weight:600;color:var(--text);">{{ cname }}</span>
              <span style="background:var(--primary-light);color:var(--primary);font-weight:700;font-size:11px;padding:2px 6px;border-radius:12px;">{{ count }} users</span>
            </div>
          {% endfor %}
        </div>
      </div>
    </div>

    <!-- Category Instructions -->
    <div class="card">
      <div class="card-header">
        <h3>💡 Category Import Options</h3>
      </div>
      <div class="card-body" style="font-size:13px;line-height:1.6;color:var(--text-secondary);">
        <div style="background:var(--bg);padding:12px;border-radius:8px;border:1px solid var(--border);margin-bottom:12px;">
          <strong style="color:var(--text);">Option 1: Add a "Category" column in your CSV</strong>
          <p style="font-size:12px;color:var(--text-tertiary);margin-top:4px;">
            Add a column named <code>Category</code> or <code>Role</code> in your spreadsheet to assign custom categories per row (e.g., <em>Sponsor Delegate</em>, <em>Invited Guest</em>).
          </p>
        </div>

        <div style="background:var(--bg);padding:12px;border-radius:8px;border:1px solid var(--border);">
          <strong style="color:var(--text);">Option 2: Select Target Category from dropdown</strong>
          <p style="font-size:12px;color:var(--text-tertiary);margin-top:4px;">
            Choose a category above before uploading. All rows without a category column will belong to that group.
          </p>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Modal for Creating New Category -->
<div id="new-cat-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999;align-items:center;justify-content:center;">
  <div style="background:#fff;border-radius:16px;padding:24px;width:100%;max-width:420px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
    <h3 style="margin-top:0;margin-bottom:8px;font-size:18px;">Create New Category</h3>
    <p style="font-size:13px;color:var(--text-tertiary);margin-bottom:16px;">Add a new category name to group users during single creation or bulk import.</p>
    <form method="post">
      {% csrf_token %}
      <input type="hidden" name="action" value="add_category">
      <label class="form-label" style="font-weight:700;">Category Name *</label>
      <input type="text" name="new_category_name" required placeholder="e.g. Media Press, Exhibitor, VIP Guest" class="form-control" style="margin-bottom:20px;">
      <div style="display:flex;justify-content:flex-end;gap:10px;">
        <button type="button" onclick="document.getElementById('new-cat-modal').style.display='none';" class="btn btn-secondary">Cancel</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-check"></i> Create Category</button>
      </div>
    </form>
  </div>
</div>
{% endblock %}
"""

with open("templates/panel/participants_upload.html", "w") as f:
    f.write(upload_html)

print("3. Updated templates/panel/participants_upload.html")
print("🎉 All Category updates applied cleanly!")
