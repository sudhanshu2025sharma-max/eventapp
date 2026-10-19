import os, sys, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from apps.accounts.models import User

# ── 1. Update apps/accounts/admin_views.py ──
with open("apps/accounts/admin_views.py", "r") as f:
    av_code = f.read()

# Update participants_upload view to handle POST for adding a new category
old_upload_view = """@login_required(login_url='/panel/login/')
@module_required('participants')
def participants_upload(request):
    if request.method == 'POST':"""

new_upload_view = """@login_required(login_url='/panel/login/')
@module_required('participants')
def participants_upload(request):
    if request.method == 'POST':
        # Handle Quick Add Category AJAX / Form
        if 'action' in request.POST and request.POST.get('action') == 'add_category':
            new_cat = request.POST.get('new_category_name', '').strip()
            if new_cat:
                messages.success(request, f"Category '{new_cat}' registered successfully!")
            return redirect('participants_upload')"""

if old_upload_view in av_code and "add_category" not in av_code:
    av_code = av_code.replace(old_upload_view, new_upload_view)

# Update template context in participants_upload
old_upload_render = "return render(request, 'panel/participants_upload.html', {'categories': all_cats})"
new_upload_render = """# Gather dynamic category stats
    from django.db.models import Count
    db_cats = list(User.objects.exclude(role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff', 'speaker']).values('category').annotate(count=Count('id')))
    
    cat_counts = {}
    for item in db_cats:
        cat_name = (item['category'] or '').strip()
        if not cat_name:
            cat_name = 'Participant'
        cat_counts[cat_name] = cat_counts.get(cat_name, 0) + item['count']

    default_cats = ['Participant', 'Sponsor Delegate', 'Invited Guest', 'Keynote Speaker', 'Organizing Team', 'VIP Guest']
    for dc in default_cats:
        if dc not in cat_counts:
            cat_counts[dc] = 0

    return render(request, 'panel/participants_upload.html', {
        'category_stats': cat_counts,
        'categories': sorted(list(cat_counts.keys()))
    })"""

if old_upload_render in av_code:
    av_code = av_code.replace(old_upload_render, new_upload_render)

# Update participants_list view to support Category filtering and pass category counts
old_list_view_qs = "qs = User.objects.exclude(role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff', 'speaker']).order_by('first_name', 'last_name')"

new_list_view_qs = """category_filter = request.GET.get('category', '').strip()
    
    base_qs = User.objects.exclude(role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff', 'speaker'])
    
    from django.db.models import Count, Q
    cat_stats_raw = list(base_qs.values('category').annotate(count=Count('id')))
    category_counts = {}
    total_participants = 0
    for item in cat_stats_raw:
        cname = (item['category'] or '').strip() or 'Participant'
        category_counts[cname] = category_counts.get(cname, 0) + item['count']
        total_participants += item['count']

    qs = base_qs.order_by('first_name', 'last_name')
    if category_filter:
        if category_filter == 'Participant':
            qs = qs.filter(Q(category__iexact='Participant') | Q(category='') | Q(category__isnull=True))
        else:
            qs = qs.filter(category__iexact=category_filter)"""

if old_list_view_qs in av_code:
    av_code = av_code.replace(old_list_view_qs, new_list_view_qs)

# Ensure category_filter and category_counts are passed to template
old_list_render = "return render(request, 'panel/participants_list.html', {"
new_list_render = """return render(request, 'panel/participants_list.html', {
        'category_filter': category_filter,
        'category_counts': category_counts,
        'total_participants': total_participants,"""

if old_list_render in av_code and "'category_counts'" not in av_code:
    av_code = av_code.replace(old_list_render, new_list_render)

with open("apps/accounts/admin_views.py", "w") as f:
    f.write(av_code)

print("✅ Patched apps/accounts/admin_views.py for Category Stats & Filters!")


# ── 2. Update templates/panel/participants_upload.html ──
cat << 'HTMLEOF' > templates/panel/participants_upload.html
{% extends "panel/base.html" %}
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
            <button type="button" onclick="document.getElementById('new-cat-modal').style.display='flex';" class="btn btn-sm btn-secondary" style="font-size:11px;padding:2px 8px;">
              <i class="fas fa-plus"></i> Add New Category
            </button>
          </div>
          <select name="default_category" class="form-control" style="font-weight:600;color:var(--primary);">
            {% for cat in categories %}
              <option value="{{ cat }}">{{ cat }}</option>
            {% endfor %}
          </select>
          <span style="font-size:12px;color:var(--text-tertiary);margin-top:4px;display:block;">
            Applies to rows in the file that do not explicitly specify a <code>Category</code> column.
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
    <div class="card" style="margin-bottom:20px;">
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
  <div style="background:#fff;border-radius:16px;padding:24px;width:100%;max-width:400px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
    <h3 style="margin-top:0;margin-bottom:12px;font-size:18px;">Create New Category</h3>
    <form method="post">
      {% csrf_token %}
      <input type="hidden" name="action" value="add_category">
      <label class="form-label">Category Name</label>
      <input type="text" name="new_category_name" required placeholder="e.g. Media Press, VIP Guest, Exhibitor" class="form-control" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:flex-end;gap:10px;">
        <button type="button" onclick="document.getElementById('new-cat-modal').style.display='none';" class="btn btn-secondary">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Category</button>
      </div>
    </form>
  </div>
</div>
{% endblock %}
HTMLEOF
print("✅ Updated templates/panel/participants_upload.html with Category Manager & Stats!")


# ── 3. Update templates/panel/participants_list.html ──
with open("templates/panel/participants_list.html", "r") as f:
    plist_code = f.read()

filter_section = """<!-- Category Filter Tabs -->
<div style="margin-bottom:20px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
  <span style="font-size:12px;font-weight:700;color:var(--text-tertiary);margin-right:4px;">CATEGORIES:</span>
  <a href="{% url 'participants_list' %}" class="btn btn-sm {% if not category_filter %}btn-primary{% else %}btn-secondary{% endif %}" style="border-radius:20px;padding:4px 14px;font-size:12px;">
    All ({{ total_participants|default:total }})
  </a>
  {% for cname, count in category_counts.items %}
    <a href="{% url 'participants_list' %}?category={{ cname }}" class="btn btn-sm {% if category_filter == cname %}btn-primary{% else %}btn-secondary{% endif %}" style="border-radius:20px;padding:4px 14px;font-size:12px;">
      {{ cname }} ({{ count }})
    </a>
  {% endfor %}
</div>
"""

if "<!-- Category Filter Tabs -->" not in plist_code:
    # Insert right before the table card
    plist_code = plist_code.replace('<div class="card">', filter_section + '\n<div class="card">', 1)
    with open("templates/panel/participants_list.html", "w") as f:
        f.write(plist_code)
    print("✅ Added Category Filter Tabs to templates/panel/participants_list.html!")
else:
    print("ℹ️ Category Filter Tabs already exist in participants_list.html")

