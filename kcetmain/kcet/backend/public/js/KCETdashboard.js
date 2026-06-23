// Dedicated KCET Counselor Dashboard Logic
let userProfile = null;
let savedOptionsList = [];
let allColleges = [];
let allCourses = [];
let activeRoadmapIndex = 1;

document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  
  const token = localStorage.getItem('kcet_jwt_token');
  if (!token) {
    Toastify({ text: "Authentication required. Redirecting...", style: { background: "#EF4444" } }).showToast();
    setTimeout(() => { window.location.href = '/kcet/login'; }, 1200);
    return;
  }
  
  await loadProfile();
  await loadColleges();
  await loadCourses();
  await loadSavedOptions();
  await loadDownloads();
  
  initializeAutocomplete();
  initializeRoadmap();
  
  // Set default active panel
  switchPanel('overview');
});

// 1. SWITCH PANELS
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

// 2. PROFILE SETTINGS
async function loadProfile() {
  const token = localStorage.getItem('kcet_jwt_token');
  try {
    const res = await fetch('/kcet/api/user/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to load profile");
    
    userProfile = await res.json();
    
    // Fill navbar user badge
    document.getElementById('nav-username').textContent = userProfile.name;
    
    // Fill overview stats
    document.getElementById('stat-rank').textContent = userProfile.rank ? Number(userProfile.rank).toLocaleString('en-IN') : 'Not Set';
    document.getElementById('stat-category').textContent = userProfile.category || 'Not Set';
    document.getElementById('stat-plan').textContent = userProfile.subscriptionType;
    document.getElementById('stat-plan').className = `sub-badge ${getBadgeClass(userProfile.subscriptionType)}`;
    
    const downloadsLeft = userProfile.pdfDownloadsLeft;
    document.getElementById('stat-downloads').textContent = downloadsLeft > 9000 ? '∞' : downloadsLeft;
    
    // Prefill profile settings form
    document.getElementById('profile-name').value = userProfile.name || '';
    document.getElementById('profile-email').value = userProfile.email || '';
    document.getElementById('profile-phone').value = userProfile.phoneNumber || '';
    document.getElementById('profile-rank').value = userProfile.rank || '';
    if (userProfile.category) {
      document.getElementById('profile-category').value = userProfile.category;
    }
    
    // Display Counselor Corner for Ultra Pro
    if (userProfile.subscriptionType === 'Ultra Pro') {
      const counselorCornerMenu = document.getElementById('menu-counselor-corner');
      if (counselorCornerMenu) counselorCornerMenu.style.display = 'flex';
      
      // Load WhatsApp group link from resources endpoint
      try {
        const resRes = await fetch('/kcet/api/subscription/resources', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resRes.ok) {
          const resources = await resRes.json();
          const waLink = document.getElementById('dash-whatsapp-link');
          if (waLink && resources.whatsappLink) {
            waLink.href = resources.whatsappLink;
          }
        }
      } catch (err) {
        console.error("Failed to load subscription resources:", err);
      }
      
      // Load past counselor requests
      await loadCounselorRequests();
    }
  } catch (err) {
    console.error(err);
    Toastify({ text: "Error loading profile data", style: { background: "#EF4444" } }).showToast();
  }
}

function getBadgeClass(type) {
  if (type === 'Pro') return 'pro';
  if (type === 'Ultra Pro') return 'ultra-pro';
  return 'basic';
}

async function handleProfileUpdate(event) {
  event.preventDefault();
  const token = localStorage.getItem('kcet_jwt_token');
  
  const name = document.getElementById('profile-name').value.trim();
  const phoneNumber = document.getElementById('profile-phone').value.trim();
  const rank = parseInt(document.getElementById('profile-rank').value, 10);
  const category = document.getElementById('profile-category').value;
  
  try {
    const res = await fetch('/kcet/api/user/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, phoneNumber, rank, category })
    });
    
    const data = await res.json();
    if (res.ok && data.success) {
      localStorage.setItem('kcet_user', JSON.stringify(data.user));
      Toastify({ text: "Profile updated successfully!", style: { background: "#10B981" } }).showToast();
      await loadProfile();
    } else {
      throw new Error(data.error || "Failed to update profile");
    }
  } catch (err) {
    console.error(err);
    Toastify({ text: err.message, style: { background: "#EF4444" } }).showToast();
  }
}

// 3. OPTION PLANNER AUTOCOMPLETE & LOADING
async function loadColleges() {
  try {
    const res = await fetch('/kcet/api/colleges');
    allColleges = await res.json();
  } catch (err) {
    console.error("Error loading colleges list:", err);
  }
}

async function loadCourses() {
  try {
    const res = await fetch('/kcet/api/courses');
    allCourses = await res.json();
    
    // Populate course dropdown selector
    const selectCourse = document.getElementById('select-course');
    selectCourse.innerHTML = '<option value="">-- Choose a course --</option>';
    allCourses.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      selectCourse.appendChild(opt);
    });
  } catch (err) {
    console.error("Error loading courses list:", err);
  }
}

function initializeAutocomplete() {
  const searchInput = document.getElementById('search-college');
  const resultsBox = document.getElementById('search-college-results');
  
  searchInput.addEventListener('input', () => {
    const val = searchInput.value.toLowerCase().trim();
    resultsBox.innerHTML = '';
    
    if (!val) {
      resultsBox.style.display = 'none';
      return;
    }
    
    const filtered = allColleges.filter(col => 
      col.college_name.toLowerCase().includes(val) || 
      col.college_code.toLowerCase().includes(val)
    ).slice(0, 10);
    
    if (filtered.length === 0) {
      resultsBox.style.display = 'none';
      return;
    }
    
    filtered.forEach(col => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.textContent = `[${col.college_code}] ${col.college_name}`;
      item.addEventListener('click', () => {
        searchInput.value = `[${col.college_code}] ${col.college_name}`;
        searchInput.dataset.code = col.college_code;
        searchInput.dataset.name = col.college_name;
        resultsBox.style.display = 'none';
      });
      resultsBox.appendChild(item);
    });
    
    resultsBox.style.display = 'block';
  });
  
  // Close search list on clicking outside
  document.addEventListener('click', (e) => {
    if (e.target !== searchInput) {
      resultsBox.style.display = 'none';
    }
  });
}

// 4. LOAD & RENDER SAVED OPTIONS LIST
async function loadSavedOptions() {
  const token = localStorage.getItem('kcet_jwt_token');
  try {
    const res = await fetch('/kcet/api/user/saved-options', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      savedOptionsList = await res.json();
      savedOptionsList.sort((a, b) => a.priority - b.priority);
      
      document.getElementById('summary-options-count').textContent = savedOptionsList.length;
      renderPlannerOptions();
    }
  } catch (err) {
    console.error(err);
  }
}

function renderPlannerOptions() {
  const listContainer = document.getElementById('planner-option-list');
  listContainer.innerHTML = '';
  
  if (savedOptionsList.length === 0) {
    listContainer.innerHTML = '<p style="color: var(--md-sys-color-on-surface-variant); font-size: 13px; font-style: italic; text-align: center; padding: 20px;">No options in your planner yet. Add options on the left.</p>';
    document.getElementById('option-validation-box').style.display = 'none';
    return;
  }
  
  savedOptionsList.forEach((opt, idx) => {
    const item = document.createElement('div');
    item.className = 'option-item';
    item.draggable = true;
    item.dataset.index = idx;
    
    // Drag events
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);
    
    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-weight: 700; font-size: 13px; color: var(--md-sys-color-primary); width: 24px;">#${idx + 1}</span>
        <div class="option-info">
          <span class="option-college">${opt.college_name}</span>
          <span class="option-course">${opt.course_name}</span>
        </div>
      </div>
      <div class="option-actions">
        <span class="option-code">${opt.college_code}</span>
        <button onclick="moveOption(${idx}, -1)" class="option-btn" title="Move Up"><i data-lucide="chevron-up" style="width: 16px; height: 16px;"></i></button>
        <button onclick="moveOption(${idx}, 1)" class="option-btn" title="Move Down"><i data-lucide="chevron-down" style="width: 16px; height: 16px;"></i></button>
        <button onclick="removeOption(${idx})" class="option-btn" title="Remove" style="color: var(--md-sys-color-error);"><i data-lucide="trash-2" style="width: 16px; height: 16px;"></i></button>
      </div>
    `;
    listContainer.appendChild(item);
  });
  
  if (window.lucide) lucide.createIcons();
  
  runOptionListValidation();
}

// Option addition logic
function addSelectedOption() {
  const searchInput = document.getElementById('search-college');
  const selectCourse = document.getElementById('select-course');
  
  const collegeCode = searchInput.dataset.code;
  const collegeName = searchInput.dataset.name;
  const courseName = selectCourse.value;
  
  if (!collegeCode || !courseName) {
    Toastify({ text: "Please select a valid college and course.", style: { background: "#EF4444" } }).showToast();
    return;
  }
  
  // Prevent duplicate additions
  const exists = savedOptionsList.some(opt => opt.college_code === collegeCode && opt.course_name === courseName);
  if (exists) {
    Toastify({ text: "This college option is already in your planner list.", style: { background: "#EF4444" } }).showToast();
    return;
  }
  
  savedOptionsList.push({
    college_code: collegeCode,
    college_name: collegeName,
    course_name: courseName,
    priority: savedOptionsList.length + 1
  });
  
  // Clear inputs
  searchInput.value = '';
  searchInput.dataset.code = '';
  searchInput.dataset.name = '';
  selectCourse.value = '';
  
  document.getElementById('summary-options-count').textContent = savedOptionsList.length;
  renderPlannerOptions();
  Toastify({ text: "Option added to list!", style: { background: "#10B981" } }).showToast();
}

function removeOption(idx) {
  savedOptionsList.splice(idx, 1);
  
  // Re-prioritize indices
  savedOptionsList.forEach((opt, index) => {
    opt.priority = index + 1;
  });
  
  document.getElementById('summary-options-count').textContent = savedOptionsList.length;
  renderPlannerOptions();
  Toastify({ text: "Option removed from list.", style: { background: "#64748b" } }).showToast();
}

function moveOption(idx, direction) {
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= savedOptionsList.length) return;
  
  // Swap elements
  const temp = savedOptionsList[idx];
  savedOptionsList[idx] = savedOptionsList[targetIdx];
  savedOptionsList[targetIdx] = temp;
  
  // Reset priority numbers
  savedOptionsList.forEach((opt, index) => {
    opt.priority = index + 1;
  });
  
  renderPlannerOptions();
}

// Drag & Drop Reordering handlers
let dragSrcEl = null;

function handleDragStart(e) {
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
  this.style.opacity = '0.4';
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  
  if (dragSrcEl !== this) {
    const srcIndex = parseInt(dragSrcEl.dataset.index, 10);
    const targetIndex = parseInt(this.dataset.index, 10);
    
    // Reorder list
    const item = savedOptionsList.splice(srcIndex, 1)[0];
    savedOptionsList.splice(targetIndex, 0, item);
    
    // Reset priority indices
    savedOptionsList.forEach((opt, index) => {
      opt.priority = index + 1;
    });
    
    renderPlannerOptions();
  }
  return false;
}

function handleDragEnd(e) {
  this.style.opacity = '1';
}

// 5. RUN DRAG-DROP SEQUENCE VALIDATION (SMART FEATURE)
// Checks if cutoffs of lower-placed options are significantly tougher than higher-placed options
async function runOptionListValidation() {
  const token = localStorage.getItem('kcet_jwt_token');
  const alertBox = document.getElementById('option-validation-box');
  const alertList = document.getElementById('option-validation-list');
  
  alertList.innerHTML = '';
  
  if (!userProfile || !userProfile.category || savedOptionsList.length < 2) {
    alertBox.style.display = 'none';
    return;
  }
  
  try {
    // Collect prediction details for all options on our list
    // To minimize requests, we query predictions for the user rank and category
    const res = await fetch(`/kcet/api/predict?rank=${userProfile.rank || 10000}&category=${userProfile.category || 'GM'}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) return;
    const predictions = await res.json();
    
    // Map options to cutoff ranks
    const cutoffs = savedOptionsList.map(opt => {
      const pred = predictions.find(p => p.college_code === opt.college_code && p.course_name === opt.course_name);
      return {
        ...opt,
        cutoff: pred ? pred.cutoff_rank_num : null
      };
    });
    
    let warnings = [];
    
    for (let i = 0; i < cutoffs.length - 1; i++) {
      const current = cutoffs[i];
      if (current.cutoff === null) continue;
      
      for (let j = i + 1; j < cutoffs.length; j++) {
        const next = cutoffs[j];
        if (next.cutoff === null) continue;
        
        // If higher-priority option current has higher cutoff (easier to get in) than lower-priority option next (tougher)
        // KEA will assign current first, and next will never be evaluated.
        if (current.cutoff > next.cutoff * 1.3) {
          warnings.push(`Sequence Hazard: Option #${i+1} (${current.college_code} - ${current.course_name}) has an easier cutoff (${current.cutoff.toLocaleString('en-IN')}) than Option #${j+1} (${next.college_code} - ${next.course_name}) with cutoff (${next.cutoff.toLocaleString('en-IN')}). If you qualify for Option #${i+1}, you will not be evaluated for Option #${j+1}. Consider placing the tougher college Option #${j+1} higher.`);
        }
      }
    }
    
    if (warnings.length > 0) {
      warnings.slice(0, 3).forEach(w => {
        const p = document.createElement('p');
        p.textContent = `• ${w}`;
        alertList.appendChild(p);
      });
      alertBox.style.display = 'flex';
    } else {
      alertBox.style.display = 'none';
    }
  } catch (err) {
    console.error("Option validation warning error:", err);
  }
}

// 6. SAVE OPTIONS PRIORITY LIST TO BACKEND
async function saveOptionPriorityList() {
  const token = localStorage.getItem('kcet_jwt_token');
  try {
    const res = await fetch('/kcet/api/user/saved-options', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ savedOptions: savedOptionsList })
    });
    
    const data = await res.json();
    if (res.ok && data.success) {
      Toastify({ text: "Priority option list saved successfully!", style: { background: "#10B981" } }).showToast();
      await loadSavedOptions();
    } else {
      throw new Error(data.error || "Failed to save options list");
    }
  } catch (err) {
    console.error(err);
    Toastify({ text: err.message, style: { background: "#EF4444" } }).showToast();
  }
}

// 7. ROADMAP TIMELINE MANAGEMENT
function initializeRoadmap() {
  const savedMilestone = localStorage.getItem('kcet_roadmap_milestone');
  if (savedMilestone !== null) {
    activeRoadmapIndex = parseInt(savedMilestone, 10);
  }
  updateRoadmapUI();
}

function setRoadmapMilestone(idx) {
  activeRoadmapIndex = idx;
  localStorage.setItem('kcet_roadmap_milestone', idx);
  updateRoadmapUI();
  Toastify({ text: "Milestone status updated!", style: { background: "#10B981" } }).showToast();
}

function updateRoadmapUI() {
  const steps = document.querySelectorAll('.roadmap-step');
  steps.forEach((step, idx) => {
    step.className = 'roadmap-step';
    if (idx < activeRoadmapIndex) {
      step.classList.add('completed');
    } else if (idx === activeRoadmapIndex) {
      step.classList.add('active');
      
      // Update overview dashboard card
      const title = step.querySelector('.roadmap-step-title').textContent;
      const desc = step.querySelector('.roadmap-step-desc').textContent;
      
      document.getElementById('current-milestone-title').textContent = title;
      document.getElementById('current-milestone-desc').textContent = desc;
    }
  });
}

// 8. LOGOUT & USER EVENTS
function handleLogout() {
  localStorage.removeItem('kcet_jwt_token');
  localStorage.removeItem('kcet_user');
  Toastify({ text: "Logged out successfully.", style: { background: "#64748b" } }).showToast();
  setTimeout(() => { window.location.href = '/kcet'; }, 1000);
}

async function handleOptionEntryRequest(event) {
  event.preventDefault();
  const token = localStorage.getItem('kcet_jwt_token');
  if (!token) {
    Toastify({ text: "Authentication required", style: { background: "#EF4444" } }).showToast();
    return;
  }
  
  const stream = document.getElementById('req-stream').value;
  const comments = document.getElementById('req-comments').value.trim();
  
  if (!stream || !comments) {
    Toastify({ text: "All fields are required", style: { background: "#EF4444" } }).showToast();
    return;
  }
  
  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';
  
  try {
    const res = await fetch('/kcet/api/user/counselor-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ stream, comments })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      Toastify({ text: "Option entry requested! Our coordinators will contact you soon.", style: { background: "#10B981" } }).showToast();
      document.getElementById('option-entry-request-form').reset();
      await loadCounselorRequests();
    } else {
      Toastify({ text: data.error || "Failed to submit request", style: { background: "#EF4444" } }).showToast();
    }
  } catch (err) {
    console.error(err);
    Toastify({ text: "Network error occurred", style: { background: "#EF4444" } }).showToast();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Request';
  }
}

async function loadCounselorRequests() {
  const token = localStorage.getItem('kcet_jwt_token');
  try {
    const res = await fetch('/kcet/api/user/counselor-requests', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      const container = document.getElementById('counselor-requests-container');
      const list = document.getElementById('counselor-requests-list');
      
      if (data.requests && data.requests.length > 0) {
        container.style.display = 'block';
        list.innerHTML = data.requests.map(r => {
          let statusColor = '#f59e0b'; // Pending
          if (r.status === 'In Progress') statusColor = '#3b82f6';
          if (r.status === 'Resolved') statusColor = '#10b981';
          
          return `
            <div style="padding: 12px; border: 1px solid var(--md-sys-color-outline); border-radius: 8px; font-size: 13px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <strong style="color: var(--md-sys-color-primary);">${r.stream}</strong>
                <span style="font-weight: 600; color: ${statusColor};">${r.status}</span>
              </div>
              <p style="color: var(--md-sys-color-on-surface-variant); margin-bottom: 8px;">${r.comments}</p>
              <div style="font-size: 11px; color: var(--md-sys-color-on-surface-variant); text-align: right;">
                Submitted on: ${new Date(r.createdAt).toLocaleDateString()}
              </div>
            </div>
          `;
        }).join('');
      } else {
        container.style.display = 'none';
      }
    }
  } catch (err) {
    console.error("Failed to load counselor requests", err);
  }
}

// 9. DYNAMIC DOWNLOADS ARCHIVE
async function loadDownloads() {
  const container = document.getElementById('downloads-list');
  if (!container) return;
  
  const historyStr = localStorage.getItem('kcet_search_history');
  
  if (!historyStr) {
    container.innerHTML = `
      <p style="color: var(--md-sys-color-on-surface-variant); font-size: 13px; font-style: italic;">
        No PDF reports downloaded yet. Perform a cutoff search and unlock to access it here.
      </p>
    `;
    return;
  }
  
  try {
    const history = JSON.parse(historyStr);
    if (!Array.isArray(history) || history.length === 0) {
      container.innerHTML = `
        <p style="color: var(--md-sys-color-on-surface-variant); font-size: 13px; font-style: italic;">
          No PDF reports downloaded yet. Perform a cutoff search and unlock to access it here.
        </p>
      `;
      return;
    }
    
    container.innerHTML = '';
    
    history.forEach((search, index) => {
      const card = document.createElement('div');
      card.className = 'md-card';
      card.style.padding = '16px';
      card.style.marginBottom = '12px';
      card.style.display = 'flex';
      card.style.justifyContent = 'space-between';
      card.style.alignItems = 'center';
      
      const cats = Array.isArray(search.selectedCategories) ? search.selectedCategories : [];
      const courses = Array.isArray(search.selectedCourses) ? search.selectedCourses : [];
      
      let catText = cats.join(', ') || 'All Categories';
      if (courses.length > 0) {
        catText += `<br/><span style="opacity: 0.8; font-size: 11px; margin-top: 2px; display: inline-block;">Courses: ${courses.join(', ')}</span>`;
      }
      
      card.innerHTML = `
        <div style="font-size: 13px;">
          <strong style="font-size: 15px; color: var(--md-sys-color-on-surface);">Rank ${search.rank}</strong><br/>
          <span style="color: var(--md-sys-color-primary); font-weight: 500;">${search.activeCategory}</span> • ${search.quotaRegion === 'RK' ? 'Gen Quota' : '371j Quota'}<br/>
          <span style="color: var(--md-sys-color-on-surface-variant); font-size: 12px; margin-top: 4px; display: inline-block;">${catText}</span>
        </div>
        <button class="md-btn md-btn-primary" style="font-size: 12px; padding: 8px 16px;" id="dl-btn-${index}">
          <i data-lucide="download" style="width: 14px; height: 14px;"></i> Download PDF
        </button>
      `;
      
      container.appendChild(card);
      
      // Add event listener to the download button
      const btn = card.querySelector(`#dl-btn-${index}`);
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" style="width: 14px; height: 14px; animation: spin 1.5s linear infinite;"></i> Generating...`;
        if (window.lucide) lucide.createIcons();
        
        try {
          const API_BASE_URL = '/kcet/api';
          const params = new URLSearchParams();
          params.append('rank', search.rank);
          params.append('category', search.selectedCategories.join(','));
          params.append('course_category', search.activeCategory);
          if (search.selectedCourses && search.selectedCourses.length > 0) {
            params.append('course_name', search.selectedCourses.join(','));
          }
          params.append('quota_region', search.quotaRegion === 'HK' ? 'HK' : 'RK');
          
          const response = await fetch(`${API_BASE_URL}/predict?${params.toString()}`);
          if (!response.ok) throw new Error("API request failed");
          
          let data = await response.json();
          data.sort((a, b) => {
            const cutA = parseInt(a.cutoff_rank_num || a.cutoff_rank, 10);
            const cutB = parseInt(b.cutoff_rank_num || b.cutoff_rank, 10);
            return cutA - cutB;
          });
          
          await generatePDF({
            rank: search.rank,
            selectedCategories: search.selectedCategories,
            selectedCourses: search.selectedCourses,
            activeCategory: search.activeCategory,
            results: data,
            API_BASE_URL,
            setLoadingState: (isLoading) => {
              if (!isLoading) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="download" style="width: 14px; height: 14px;"></i> Download PDF`;
                if (window.lucide) lucide.createIcons();
              }
            }
          });
          
          Toastify({ text: "PDF generated successfully!", style: { background: "#10B981" } }).showToast();
        } catch (err) {
          console.error(err);
          Toastify({ text: "Failed to generate report PDF", style: { background: "#EF4444" } }).showToast();
          btn.disabled = false;
          btn.innerHTML = `<i data-lucide="download" style="width: 14px; height: 14px;"></i> Download PDF`;
          if (window.lucide) lucide.createIcons();
        }
      });
    });
    
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error("Error loading downloads list:", err);
  }
}
