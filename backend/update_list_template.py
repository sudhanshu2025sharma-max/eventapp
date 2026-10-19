with open("templates/panel/participants_list.html", "r") as f:
    content = f.read()

# Add Category & Temp Password table headers
old_headers = """          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Reg ID</th>
            <th>Affiliation</th>
            <th>Check-In</th>"""

new_headers = """          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Email</th>
            <th>Reg ID</th>
            <th>Temp Password</th>
            <th>Affiliation</th>
            <th>Check-In</th>"""

content = content.replace(old_headers, new_headers)

# Add Category & Temp Password table data cells
old_cells = """          <tr>
            <td style="font-weight:600;">{{ p.get_full_name }}</td>
            <td>{{ p.email }}</td>
            <td><code>{{ p.registration_id|default:"—" }}</code></td>
            <td>{{ p.affiliation|default:"—" }}</td>"""

new_cells = """          <tr>
            <td style="font-weight:600;">{{ p.get_full_name }}</td>
            <td>
              <span class="badge" style="background:#e0e7ff;color:#3730a3;font-weight:700;">
                {{ p.category|default:p.get_role_display|default:"Participant" }}
              </span>
            </td>
            <td>{{ p.email }}</td>
            <td><code>{{ p.registration_id|default:"—" }}</code></td>
            <td>
              {% if p.must_change_password and p.temp_password %}
                <code style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-weight:bold;">{{ p.temp_password }}</code>
              {% else %}
                <span style="color:var(--text-tertiary);font-size:12px;">(Password Set)</span>
              {% endif %}
            </td>
            <td>{{ p.affiliation|default:"—" }}</td>"""

content = content.replace(old_cells, new_cells)

with open("templates/panel/participants_list.html", "w") as f:
    f.write(content)

print("✅ Updated templates/panel/participants_list.html with Category badges and Temp Password column!")
