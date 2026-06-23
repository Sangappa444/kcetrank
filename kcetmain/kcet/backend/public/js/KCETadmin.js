// KCET Admin Control Center Logic
let dashboardData = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  
  const token = localStorage.getItem('kcet_jwt_token');
  if (!token) {
    Toastify({ text: "Authentication required. Redirecting...", style: { background: "#EF4444" } }).showToast();
    setTimeout(() => { window.location.href = '/kcet/login'; }, 1200);
    return;
  }
  
  await fetchDashboardData();
  
  // Default panel
  switchPanel('overview');
});

// 1. NAVIGATION
function switchPanel(panelId) {
  const panels = document.querySelectorAll('.dashboard-panel');
  panels.forEach(p => p.classList.remove('active'));
  
  const targetPanel = document.getElementById(`panel-${panelId}`);
  if (targetPanel) targetPanel.classList.add('active');
  
  const railItems = document.querySelectorAll('.rail-item');
  railItems.forEach(item => item.classList.remove('active'));
  
  // Find matching menu item
  const menuBtn = Array.from(railItems).find(item => item.getAttribute('onclick').includes(panelId));
  if (menuBtn) menuBtn.classList.add('active');
}

// 2. FETCH DASHBOARD DATA
async function fetchDashboardData() {
  showLoader(true);
  const token = localStorage.getItem('kcet_jwt_token');
  
  try {
    const res = await fetch('/kcet/api/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 401 || res.status === 403) {
      Toastify({ text: "Administrator privileges required", style: { background: "#EF4444" } }).showToast();
      setTimeout(() => { window.location.href = '/kcet/dashboard'; }, 1500);
      return;
    }
    
    if (!res.ok) throw new Error("Failed to load admin stats");
    
    dashboardData = await res.json();
    renderOverview();
    renderSubscribers();
    renderRequests();
    
  } catch (err) {
    console.error(err);
    Toastify({ text: "Error fetching admin data", style: { background: "#EF4444" } }).showToast();
  } finally {
    showLoader(false);
  }
}

// 3. RENDER OVERVIEW
function renderOverview() {
  const m = dashboardData.metrics;
  document.getElementById('metric-total-subscribers').textContent = m.proCount + m.ultraProCount;
  document.getElementById('metric-pro-count').textContent = m.proCount;
  document.getElementById('metric-ultra-pro-count').textContent = m.ultraProCount;
  document.getElementById('metric-revenue').textContent = `₹${Number(m.totalRevenue).toLocaleString('en-IN')}`;
  document.getElementById('metric-pending-requests').textContent = m.pendingRequests;
}

// 4. RENDER SUBSCRIBERS
function renderSubscribers(filterText = '') {
  const tbody = document.getElementById('subscribers-list-body');
  if (!tbody) return;
  
  const subscribers = dashboardData.subscribers;
  const filtered = subscribers.filter(s => {
    const query = filterText.toLowerCase();
    return (s.name || '').toLowerCase().includes(query) ||
           (s.email || '').toLowerCase().includes(query) ||
           (s.phoneNumber || '').toLowerCase().includes(query) ||
           (s.category || '').toLowerCase().includes(query);
  });
  
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <i data-lucide="users" class="empty-icon"></i>
            <p>No subscribers found matching criteria</p>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }
  
  tbody.innerHTML = filtered.map(s => {
    const optCount = s.savedOptions ? s.savedOptions.length : 0;
    const badgeClass = s.subscriptionType === 'Ultra Pro' ? 'ultra-pro' : 'pro';
    return `
      <tr>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${escapeHtml(s.email)}</td>
        <td>${s.phoneNumber ? escapeHtml(s.phoneNumber) : '<span style="color:#94a3b8; font-style:italic;">None</span>'}</td>
        <td>${s.rank ? Number(s.rank).toLocaleString('en-IN') : '<span style="color:#94a3b8; font-style:italic;">Not Set</span>'}</td>
        <td>${s.category ? escapeHtml(s.category) : '<span style="color:#94a3b8; font-style:italic;">Not Set</span>'}</td>
        <td><span class="status-badge ${badgeClass}">${s.subscriptionType}</span></td>
        <td><strong>${optCount}</strong> colleges saved</td>
      </tr>
    `;
  }).join('');
}

// 5. RENDER REQUESTS
function renderRequests(filterText = '') {
  const tbody = document.getElementById('requests-list-body');
  if (!tbody) return;
  
  const requests = dashboardData.counselingRequests;
  const filtered = requests.filter(r => {
    const query = filterText.toLowerCase();
    return (r.userName || '').toLowerCase().includes(query) ||
           (r.userEmail || '').toLowerCase().includes(query) ||
           (r.stream || '').toLowerCase().includes(query) ||
           (r.status || '').toLowerCase().includes(query);
  });
  
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <i data-lucide="inbox" class="empty-icon"></i>
            <p>No counseling requests in the queue</p>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }
  
  tbody.innerHTML = filtered.map(r => {
    const statusClass = r.status.toLowerCase().replace(' ', '');
    return `
      <tr>
        <td>
          <strong>${escapeHtml(r.userName)}</strong><br/>
          <span style="font-size: 12px; color: var(--md-sys-color-on-surface-variant);">${escapeHtml(r.userEmail)}</span>
        </td>
        <td>${escapeHtml(r.userPhone)}</td>
        <td><strong style="color: var(--md-sys-color-primary);">${escapeHtml(r.stream)}</strong></td>
        <td>
          <div style="max-width: 250px; font-size: 13px; line-height: 1.4; color: var(--md-sys-color-on-surface-variant);">
            ${escapeHtml(r.comments)}
          </div>
        </td>
        <td style="font-size: 12px;">${new Date(r.createdAt).toLocaleDateString('en-IN', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</td>
        <td><span class="status-badge ${statusClass}">${r.status}</span></td>
        <td>
          <select class="action-select" onchange="updateRequestStatus('${r._id}', this.value)">
            <option value="Pending" ${r.status === 'Pending' ? 'selected' : ''}>Set Pending</option>
            <option value="In Progress" ${r.status === 'In Progress' ? 'selected' : ''}>Set In Progress</option>
            <option value="Resolved" ${r.status === 'Resolved' ? 'selected' : ''}>Set Resolved</option>
          </select>
        </td>
      </tr>
    `;
  }).join('');
  
  if (window.lucide) lucide.createIcons();
}

// 6. UPDATE REQUEST STATUS
async function updateRequestStatus(requestId, newStatus) {
  showLoader(true);
  const token = localStorage.getItem('kcet_jwt_token');
  
  try {
    const res = await fetch('/kcet/api/admin/request/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ requestId, status: newStatus })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      Toastify({ text: `Request status updated to ${newStatus}`, style: { background: "#10b981" } }).showToast();
      // Reload stats
      await fetchDashboardData();
    } else {
      Toastify({ text: data.error || "Failed to update status", style: { background: "#ef4444" } }).showToast();
      showLoader(false);
    }
  } catch (err) {
    console.error(err);
    Toastify({ text: "Error updating status", style: { background: "#ef4444" } }).showToast();
    showLoader(false);
  }
}

// 7. FILTERS
function filterSubscribersTable() {
  const query = document.getElementById('search-subscribers').value;
  renderSubscribers(query);
}

function filterRequestsTable() {
  const query = document.getElementById('search-requests').value;
  renderRequests(query);
}

// 8. LOGOUT
function handleLogout() {
  localStorage.removeItem('kcet_jwt_token');
  localStorage.removeItem('kcet_user');
  Toastify({ text: "Logged out", style: { background: "#64748b" } }).showToast();
  setTimeout(() => { window.location.href = '/kcet'; }, 1000);
}

// Helpers
function showLoader(show) {
  const loader = document.getElementById('loading-indicator');
  if (loader) loader.style.display = show ? 'flex' : 'none';
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
