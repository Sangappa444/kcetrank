// public/js/main.js

const API_BASE_URL = '/kcet/api';

// Multi-Select & Dynamic Logic
const rkCategories = [
  '1G', '1K', '1R', '2AG', '2AK', '2AR', '2BG', '2BK', '2BR',
  '3AG', '3AK', '3AR', '3BG', '3BK', '3BR',
  'GM', 'GMK', 'GMR', 'SCG', 'SCK', 'SCR', 'STG', 'STK', 'STR'
];

const hkCategories = [
  '1H', '1KH', '1RH', '2AH', '2AKH', '2ARH', '2BH', '2BKH', '2BRH',
  '3AH', '3AKH', '3ARH', '3BH', '3BKH', '3BRH',
  'GMH', 'GMKH', 'GMRH', 'SCH', 'SCKH', 'SCRH', 'STH', 'STKH', 'STRH'
];

let selectedCategories = [];
let selectedCourses = [];
let quotaRegion = 'RK';
let allCourses = [];

// Elements
const tabsContainer = document.getElementById('tabs-container');
const rankInput = document.getElementById('rank');
const predictionForm = document.getElementById('prediction-form');
const btnRk = document.getElementById('btn-rk');
const btnHk = document.getElementById('btn-hk');
const predictBtn = document.getElementById('predict-btn');
const resultsSection = document.getElementById('results-section');
const resultsTitleText = document.getElementById('results-title-text');
const resultsList = document.getElementById('results-list');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const downloadBtn = document.getElementById('download-btn');
const downloadText = document.getElementById('download-text');

const categoryIcons = {
  'Engineering': 'cpu',
  'Agriculture': 'leaf',
  'Veterinary': 'award',
  'B.Pharm': 'pill',
  'D.Pharm': 'pill',
  'B.Sc Nursing': 'heart-pulse',
  'BNYS': 'activity',
  'Allied Health Sciences': 'stethoscope',
  'BPT': 'graduation-cap',
  'BPO': 'stethoscope',
  'Architecture': 'compass'
};

// State
let appState = {
  rank: '',
  categories: [],
  activeCategory: 'Engineering',
  courses: [],
  rawResults: [],
  results: [],
  appliedCoupon: null,
  hasPaid: false,
  user: null
};

// Signature to uniquely identify a search to prevent losing paid reports
function getSearchSignature() {
  const catStr = [...selectedCategories].sort().join(',');
  const courseStr = [...selectedCourses].sort().join(',');
  return btoa(`${appState.rank}_${appState.activeCategory}_${catStr}_${courseStr}`);
}

// Multi-Select Helper Functions
function normalizeText(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/artifical/g, 'artificial')
    .replace(/sicence/g, 'science')
    .replace(/virutal/g, 'virtual')
    .replace(/mathamatics/g, 'mathematics')
    .replace(/pharmaceutic/g, 'pharmaceutical')
    .replace(/dpharm/g, 'pharmd')
    .replace(/pharmad/g, 'pharmd')
    .replace(/bpharma/g, 'bpharm');
}

function matchCourse(courseName, query) {
  const normCourse = normalizeText(courseName);
  const normQuery = normalizeText(query);

  if (normCourse.includes(normQuery)) return true;

  const lowerQuery = query.toLowerCase().trim();
  if ((lowerQuery === 'cs' || lowerQuery === 'cse') && normCourse.includes('computerscience')) return true;
  if ((lowerQuery === 'is' || lowerQuery === 'ise') && normCourse.includes('informationscience')) return true;
  if ((lowerQuery === 'ec' || lowerQuery === 'ece') && normCourse.includes('electronics') && (normCourse.includes('communication') || normCourse.includes('communicatio'))) return true;
  if ((lowerQuery === 'ee' || lowerQuery === 'eee') && normCourse.includes('electrical') && normCourse.includes('electronics')) return true;
  if ((lowerQuery === 'me' || lowerQuery === 'mech') && normCourse.includes('mechanical')) return true;
  if ((lowerQuery === 'cv' || lowerQuery === 'ce') && normCourse.includes('civil')) return true;
  if (lowerQuery === 'bt' && (normCourse.includes('biotech') || normCourse.includes('biotechnology'))) return true;
  if ((lowerQuery === 'ai' || lowerQuery === 'ml' || lowerQuery === 'aiml') && (normCourse.includes('artificialintelligence') || normCourse.includes('machinelearning') || normCourse.includes('aiml'))) return true;
  if (lowerQuery === 'iot' && (normCourse.includes('internetofthings') || normCourse.includes('iot'))) return true;
  if ((lowerQuery === 'ag' || lowerQuery === 'agri') && (normCourse.includes('agriculture') || normCourse.includes('agbusiness') || normCourse.includes('agri'))) return true;

  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (queryWords.length > 1) {
    return queryWords.every(word => normalizeText(word) && normCourse.includes(normalizeText(word)));
  }

  return false;
}

function filterCategories(term) {
  const query = term.toLowerCase().trim();
  const options = document.querySelectorAll('#category-checkbox-list .checkbox-option');
  options.forEach(opt => {
    const text = opt.querySelector('span').textContent.toLowerCase();
    opt.style.display = text.includes(query) ? 'flex' : 'none';
  });
}

function filterCourses(term) {
  const query = term.trim();
  const options = document.querySelectorAll('#course-checkbox-list .checkbox-option');
  options.forEach(opt => {
    const courseName = opt.querySelector('span').textContent;
    opt.style.display = (!query || matchCourse(courseName, query)) ? 'flex' : 'none';
  });
}

function updateCategoryTriggerText() {
  const selectedText = document.getElementById('category-selected-text');
  if (selectedCategories.length === 0) {
    selectedText.textContent = 'Select Category';
  } else if (selectedCategories.length === 1) {
    selectedText.textContent = selectedCategories[0];
  } else {
    selectedText.textContent = `${selectedCategories.length} Categories Selected`;
  }
}

function updateCourseTriggerText() {
  const selectedText = document.getElementById('course-selected-text');
  if (selectedCourses.length === 0) {
    selectedText.textContent = `All Courses`;
  } else if (selectedCourses.length === 1) {
    selectedText.textContent = selectedCourses[0];
  } else {
    selectedText.textContent = `${selectedCourses.length} Courses Selected`;
  }
}

function handleCategoryChange(checkbox) {
  const val = checkbox.value;
  if (checkbox.checked) {
    if (!selectedCategories.includes(val)) selectedCategories.push(val);
  } else {
    selectedCategories = selectedCategories.filter(c => c !== val);
  }
  updateCategoryTriggerText();
}

function handleCourseChange(checkbox) {
  const val = checkbox.value;
  if (checkbox.checked) {
    if (!selectedCourses.includes(val)) selectedCourses.push(val);
  } else {
    selectedCourses = selectedCourses.filter(c => c !== val);
  }
  updateCourseTriggerText();
}

function renderCategoryCheckboxes(list) {
  const listContainer = document.getElementById('category-checkbox-list');
  let html = '';
  list.forEach(c => {
    const checked = selectedCategories.includes(c) ? 'checked' : '';
    html += `
      <label class="checkbox-option" data-value="${c}">
        <input type="checkbox" value="${c}" ${checked} onchange="handleCategoryChange(this)">
        <span>${c}</span>
      </label>
    `;
  });
  listContainer.innerHTML = html;
}

function renderCourseCheckboxes() {
  const listContainer = document.getElementById('course-checkbox-list');
  const filteredCourses = allCourses.filter(c => getCategoryForCourse(c) === appState.activeCategory);

  if (filteredCourses.length === 0) {
    listContainer.innerHTML = `<div style="padding: 0.5rem; font-size: 0.9rem; color: #6b7280;">No courses available</div>`;
    return;
  }
  let html = '';
  filteredCourses.forEach(c => {
    const checked = selectedCourses.includes(c) ? 'checked' : '';
    html += `
      <label class="checkbox-option" data-value="${c}">
        <input type="checkbox" value="${c}" ${checked} onchange="handleCourseChange(this)">
        <span title="${c}">${c}</span>
      </label>
    `;
  });
  listContainer.innerHTML = html;
}

function updateCategoryDropdown() {
  const list = quotaRegion === 'RK' ? rkCategories : hkCategories;
  const defaultCat = quotaRegion === 'RK' ? 'GM' : 'GMH';
  selectedCategories = [defaultCat];
  renderCategoryCheckboxes(list);
  updateCategoryTriggerText();
}

function setRegion(region) {
  quotaRegion = region;
  if (region === 'RK') {
    btnRk.classList.add('active');
    btnHk.classList.remove('active');
  } else {
    btnHk.classList.add('active');
    btnRk.classList.remove('active');
  }
  updateCategoryDropdown();
}

function setupMultiSelectDropdowns() {
  const categoryTrigger = document.getElementById('category-trigger');
  const categoryDropdown = document.getElementById('category-dropdown');
  const courseTrigger = document.getElementById('course-trigger');
  const courseDropdown = document.getElementById('course-dropdown');

  categoryTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    categoryTrigger.classList.toggle('active');
    const show = categoryTrigger.classList.contains('active');
    categoryDropdown.style.display = show ? 'flex' : 'none';
    if (show) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';

    courseTrigger.classList.remove('active');
    courseDropdown.style.display = 'none';
  });

  courseTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    courseTrigger.classList.toggle('active');
    const show = courseTrigger.classList.contains('active');
    courseDropdown.style.display = show ? 'flex' : 'none';
    if (show) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';

    categoryTrigger.classList.remove('active');
    categoryDropdown.style.display = 'none';
  });

  const closeCategoryModal = () => {
    categoryTrigger.classList.remove('active');
    categoryDropdown.style.display = 'none';
    document.body.style.overflow = '';
  };

  const closeCourseModal = () => {
    courseTrigger.classList.remove('active');
    courseDropdown.style.display = 'none';
    document.body.style.overflow = '';
  };

  const bindModalClose = (btnId, handler) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const handleEvent = (e) => {
      e.preventDefault();
      handler();
    };
    btn.addEventListener('click', handleEvent);
    btn.addEventListener('touchend', handleEvent);
  };

  bindModalClose('category-close', closeCategoryModal);
  bindModalClose('category-apply', closeCategoryModal);

  bindModalClose('course-close', closeCourseModal);
  bindModalClose('course-apply', closeCourseModal);

  // Close when clicking the semi-transparent background overlay
  categoryDropdown.addEventListener('click', (e) => {
    if (e.target === categoryDropdown) closeCategoryModal();
  });

  courseDropdown.addEventListener('click', (e) => {
    if (e.target === courseDropdown) closeCourseModal();
  });

  document.addEventListener('click', (e) => {
    // If we click outside the modal-content but not on the trigger itself, close modals
    if (!document.getElementById('category-container').contains(e.target)) {
      closeCategoryModal();
    }
    if (!document.getElementById('course-container').contains(e.target)) {
      closeCourseModal();
    }
  });

  document.getElementById('category-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });
  document.getElementById('course-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });

  document.getElementById('category-select-all').addEventListener('click', () => {
    document.querySelectorAll('#category-checkbox-list .checkbox-option').forEach(opt => {
      if (opt.style.display !== 'none') {
        const cb = opt.querySelector('input[type="checkbox"]');
        if (cb && !cb.checked) {
          cb.checked = true;
          if (!selectedCategories.includes(cb.value)) selectedCategories.push(cb.value);
        }
      }
    });
    updateCategoryTriggerText();
  });

  document.getElementById('category-clear-all').addEventListener('click', () => {
    document.querySelectorAll('#category-checkbox-list .checkbox-option').forEach(opt => {
      if (opt.style.display !== 'none') {
        const cb = opt.querySelector('input[type="checkbox"]');
        if (cb && cb.checked) {
          cb.checked = false;
          selectedCategories = selectedCategories.filter(c => c !== cb.value);
        }
      }
    });
    updateCategoryTriggerText();
  });

  document.getElementById('course-select-all').addEventListener('click', () => {
    document.querySelectorAll('#course-checkbox-list .checkbox-option').forEach(opt => {
      if (opt.style.display !== 'none') {
        const cb = opt.querySelector('input[type="checkbox"]');
        if (cb && !cb.checked) {
          cb.checked = true;
          if (!selectedCourses.includes(cb.value)) selectedCourses.push(cb.value);
        }
      }
    });
    updateCourseTriggerText();
  });

  document.getElementById('course-clear-all').addEventListener('click', () => {
    document.querySelectorAll('#course-checkbox-list .checkbox-option').forEach(opt => {
      if (opt.style.display !== 'none') {
        const cb = opt.querySelector('input[type="checkbox"]');
        if (cb && cb.checked) {
          cb.checked = false;
          selectedCourses = selectedCourses.filter(c => c !== cb.value);
        }
      }
    });
    updateCourseTriggerText();
  });
}

function calculateDynamicPrice() {
  if (appState.appliedCoupon === 'admin100') {
    return 0;
  }
  let amount = 99;
  const extraCats = selectedCategories.length - 1;
  const extraCourses = selectedCourses.length - 1;
  if (extraCats > 0) amount += extraCats * 30;
  if (extraCourses > 0) amount += extraCourses * 10;
  return amount;
}

async function handleApplyCoupon() {
  const couponInput = document.getElementById('coupon-input');
  const couponMessage = document.getElementById('coupon-message');
  if (!couponInput || !couponMessage) return;

  const code = couponInput.value.trim();
  if (!code) {
    couponMessage.textContent = "Please enter a coupon code.";
    couponMessage.style.color = "#EF4444"; // Red
    couponMessage.style.display = "block";
    return;
  }

  couponMessage.textContent = "Validating coupon...";
  couponMessage.style.color = "#64748B"; // Slate
  couponMessage.style.display = "block";

  try {
    const response = await fetch('/kcet/api/payment/validate-coupon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ couponCode: code })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      appState.appliedCoupon = data.couponCode;
      couponMessage.textContent = data.message || "Coupon applied successfully!";
      couponMessage.style.color = "#10B981"; // Green

      // Update button text instantly
      downloadText.textContent = "Unlock Full Report (FREE)";
      Toastify({ text: "Coupon applied successfully!", style: { background: "#10B981" } }).showToast();
    } else {
      appState.appliedCoupon = null;
      couponMessage.textContent = data.message || "Invalid coupon code.";
      couponMessage.style.color = "#EF4444"; // Red

      // Update button text back
      const price = calculateDynamicPrice();
      downloadText.textContent = `Unlock Full Report (₹${price})`;
      Toastify({ text: data.message || "Invalid coupon code", style: { background: "#EF4444" } }).showToast();
    }
  } catch (err) {
    console.error(err);
    appState.appliedCoupon = null;
    couponMessage.textContent = "Failed to validate coupon code.";
    couponMessage.style.color = "#EF4444"; // Red

    // Update button text back
    const price = calculateDynamicPrice();
    downloadText.textContent = `Unlock Full Report (₹${price})`;
    Toastify({ text: "Coupon validation failed", style: { background: "#EF4444" } }).showToast();
  }
}

function attachEventListeners() {
  predictionForm.addEventListener('submit', handlePredict);
  downloadBtn.addEventListener('click', handleDownloadPayment);

  const applyCouponBtn = document.getElementById('apply-coupon-btn');
  if (applyCouponBtn) {
    applyCouponBtn.addEventListener('click', handleApplyCoupon);
  }

  const seatTypeEl = document.getElementById('seat-type');
  if (seatTypeEl) seatTypeEl.addEventListener('change', () => applyPostPredictionFilters(false));
  const districtEl = document.getElementById('district');
  if (districtEl) districtEl.addEventListener('change', () => applyPostPredictionFilters(false));
  const sortByEl = document.getElementById('sort-by');
  if (sortByEl) sortByEl.addEventListener('change', () => applyPostPredictionFilters(false));
}

async function checkAuth() {
  const token = localStorage.getItem('kcet_jwt_token');
  const navAuth = document.getElementById('nav-auth');
  
  // Pricing buttons
  const planBtnBasic = document.getElementById('plan-btn-basic');
  const planBtnPro = document.getElementById('plan-btn-pro');
  const planBtnUltra = document.getElementById('plan-btn-ultra');

  if (!token) {
    if (navAuth) {
      navAuth.innerHTML = `
        <a href="/kcet/login" class="nav-login-btn">
          <i data-lucide="log-in" style="width: 16px; height: 16px;"></i>
          <span>Login / Register</span>
        </a>
      `;
    }
    
    // Set pricing buttons to login redirect
    if (planBtnPro) {
      planBtnPro.textContent = 'Login to Upgrade';
      planBtnPro.onclick = () => window.location.href = '/kcet/login';
    }
    if (planBtnUltra) {
      planBtnUltra.textContent = 'Login to Upgrade';
      planBtnUltra.onclick = () => window.location.href = '/kcet/login';
    }

    if (window.lucide) lucide.createIcons();
    return;
  }

  try {
    const res = await fetch('/kcet/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.ok) {
      const user = await res.json();
      appState.user = user;
      const subClass = user.subscriptionType.toLowerCase().replace(' ', '-');
      
      // 1. Update Navbar
      if (navAuth) {
        navAuth.innerHTML = `
          <div class="nav-user-info">
            <div class="nav-user-details">
              <i data-lucide="user" style="width: 18px; height: 18px; color: #64748b;"></i>
              <span class="nav-user-name">Welcome, ${user.name}</span>
              <span class="sub-badge ${subClass}">${user.subscriptionType}</span>
            </div>
            <a href="/kcet/dashboard" class="nav-login-btn" style="background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 4px 12px -2px rgba(16, 185, 129, 0.3); display: flex; align-items: center; gap: 6px;">
              <i data-lucide="layout-dashboard" style="width: 16px; height: 16px;"></i>
              <span>Dashboard</span>
            </a>
            <button onclick="handleLogout()" class="nav-logout-btn">
              <i data-lucide="log-out" style="width: 16px; height: 16px;"></i>
              <span>Logout</span>
            </button>
          </div>
        `;
      }

      // 2. Update Pricing Card buttons
      if (planBtnBasic) {
        planBtnBasic.textContent = user.subscriptionType === 'Basic' ? 'Current Active Plan' : 'Basic Plan';
      }

      if (planBtnPro) {
        if (user.subscriptionType === 'Pro') {
          planBtnPro.textContent = 'Current Active Plan';
          planBtnPro.disabled = true;
          planBtnPro.style.background = '#f1f5f9';
          planBtnPro.style.color = '#64748b';
          planBtnPro.style.border = '1px solid #cbd5e1';
          planBtnPro.style.boxShadow = 'none';
          planBtnPro.style.cursor = 'default';
        } else if (user.subscriptionType === 'Ultra Pro') {
          planBtnPro.textContent = 'Included in Ultra Pro';
          planBtnPro.disabled = true;
          planBtnPro.style.background = '#f8fafc';
          planBtnPro.style.color = '#94a3b8';
          planBtnPro.style.border = '1px solid #e2e8f0';
          planBtnPro.style.boxShadow = 'none';
          planBtnPro.style.cursor = 'default';
        } else {
          planBtnPro.textContent = 'Upgrade to Pro';
          planBtnPro.disabled = false;
          planBtnPro.onclick = () => purchaseSubscription('Pro');
        }
      }

      if (planBtnUltra) {
        if (user.subscriptionType === 'Ultra Pro') {
          planBtnUltra.textContent = 'Current Active Plan';
          planBtnUltra.disabled = true;
          planBtnUltra.style.background = '#f1f5f9';
          planBtnUltra.style.color = '#64748b';
          planBtnUltra.style.border = '1px solid #cbd5e1';
          planBtnUltra.style.boxShadow = 'none';
          planBtnUltra.style.cursor = 'default';
        } else {
          planBtnUltra.textContent = 'Upgrade to Ultra Pro';
          planBtnUltra.disabled = false;
          planBtnUltra.onclick = () => purchaseSubscription('Ultra Pro');
        }
      }

    } else {
      localStorage.removeItem('kcet_jwt_token');
      localStorage.removeItem('kcet_user');
      if (navAuth) {
        navAuth.innerHTML = `
          <a href="/kcet/login" class="nav-login-btn">
            <i data-lucide="log-in" style="width: 16px; height: 16px;"></i>
            <span>Login / Register</span>
          </a>
        `;
      }
    }
  } catch (err) {
    console.error('Auth check error:', err);
  }

  if (window.lucide) lucide.createIcons();
}

function handleLogout() {
  localStorage.removeItem('kcet_jwt_token');
  localStorage.removeItem('kcet_user');
  window.location.reload();
}

async function purchaseSubscription(planType) {
  const token = localStorage.getItem('kcet_jwt_token');
  if (!token) {
    Toastify({ text: "Please login to purchase a subscription", style: { background: "#EF4444" } }).showToast();
    setTimeout(() => { window.location.href = '/kcet/login'; }, 1000);
    return;
  }

  // Request & validate 10-digit WhatsApp number
  const prefillPhone = (appState.user && appState.user.phoneNumber) || '';
  const phoneNumber = prompt("Please enter your 10-digit WhatsApp mobile number for plan notifications & updates:", prefillPhone);
  if (phoneNumber === null) return; // User cancelled

  const cleanedPhone = phoneNumber.replace(/\D/g, '');
  if (cleanedPhone.length !== 10) {
    Toastify({ text: "Please enter a valid 10-digit mobile number.", style: { background: "#EF4444" } }).showToast();
    return;
  }

  Toastify({ text: "Initiating order...", style: { background: "#4F46E5" } }).showToast();

  try {
    const response = await fetch('/kcet/api/payment/subscription/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ planType })
    });

    if (!response.ok) throw new Error("Failed to create subscription order");

    const order = await response.json();
    const rzpKey = document.getElementById('rzp-key').value;

    const options = {
      key: rzpKey,
      amount: order.amount,
      currency: order.currency,
      name: "Vidyari Counseling",
      description: `Upgrade to ${planType} Plan`,
      order_id: order.id,
      handler: async function (response) {
        try {
          Toastify({ text: "Verifying payment...", style: { background: "#4F46E5" } }).showToast();
          
          const verifyResponse = await fetch('/kcet/api/payment/subscription/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planType,
              phoneNumber: cleanedPhone
            })
          });

          const data = await verifyResponse.json();
          if (verifyResponse.ok && data.success) {
            localStorage.setItem('kcet_user', JSON.stringify(data.user));
            Toastify({ text: `Upgrade successful! Welcome to ${planType}.`, style: { background: "#10B981" } }).showToast();
            await checkAuth();
          } else {
            throw new Error(data.error || "Payment verification failed");
          }
        } catch (verifyErr) {
          console.error(verifyErr);
          Toastify({ text: verifyErr.message || "Failed to verify payment.", style: { background: "#EF4444" } }).showToast();
        }
      },
      prefill: {
        name: appState.user ? appState.user.name : "Student",
        email: appState.user ? appState.user.email : "student@example.com"
      },
      theme: { color: "#4F46E5" }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  } catch (err) {
    console.error(err);
    Toastify({ text: "Failed to upgrade subscription.", style: { background: "#EF4444" } }).showToast();
  }
}

function handleOptionEntryRequest(event) {
  event.preventDefault();
  
  Toastify({ text: "Submitting request...", style: { background: "#4F46E5" } }).showToast();
  
  setTimeout(() => {
    Toastify({ text: "Request submitted! A counselor will contact you within 24 hours.", style: { background: "#10B981" } }).showToast();
    document.getElementById('option-entry-request-form').reset();
  }, 1000);
}

window.handleLogout = handleLogout;
window.purchaseSubscription = purchaseSubscription;
window.handleOptionEntryRequest = handleOptionEntryRequest;

// Initialize
async function init() {
  await checkAuth();
  attachEventListeners();

  // Setup region buttons
  btnRk.addEventListener('click', () => setRegion('RK'));
  btnHk.addEventListener('click', () => setRegion('HK'));

  // Initialize multi-select
  setupMultiSelectDropdowns();
  updateCategoryDropdown();

  await fetchCategories();
  await fetchCourses();

  // Show recent searches on load
  renderRecentSearches();

  // Update download button text when selections change
  setInterval(() => {
    if (appState.results.length > 0) {
      if (appState.hasPaid) {
        downloadText.textContent = 'Download PDF Manually';
      } else {
        const price = calculateDynamicPrice();
        if (price === 0) {
          downloadText.textContent = `Unlock Full Report (FREE)`;
        } else {
          downloadText.textContent = `Unlock Full Report (₹${price})`;
        }
      }
    }
  }, 500);
}

// Fetch APIs
async function fetchCategories() {
  try {
    const res = await fetch(`${API_BASE_URL}/categories`);
    appState.categories = await res.json();
  } catch (err) {
    appState.categories = ['Engineering', 'Agriculture', 'Veterinary', 'B.Pharm', 'D.Pharm', 'B.Sc Nursing', 'BNYS', 'Allied Health Sciences', 'BPT', 'BPO', 'Architecture'];
  }
  renderTabs();
}

function getCategoryForCourse(courseName) {
  if (!courseName) return 'Engineering';
  const name = courseName.toUpperCase();
  if (name.includes('ARCHITECTURE')) return 'Architecture';
  if (name.includes('B-PHARMA')) return 'B.Pharm';
  if (name.includes('PHARMA-D') || name.includes('PHARM-D')) return 'D.Pharm';
  if (name.includes('VETERINARY') || name.includes('VETER SCI') || name.includes('B.V.SC')) return 'Veterinary';
  if (name.includes('NURSING')) return 'B.Sc Nursing';
  if (name.includes('BNYS') || name.includes('NATUROPATHY') || name.includes('YOGA')) return 'BNYS';
  if (name.includes('PHYSIOTHERAPY') || name.includes('BPT')) return 'BPT';
  if (name.includes('PROSTHETICS ORTHOTICS') || name.includes('BPO')) return 'BPO';
  if (name.includes('OPTOMETRY')) return 'BPO';

  if (name.includes('AGRICULTURE') || name.includes('AGRI') || name.includes('FORESTRY') ||
    name.includes('HORTICULTURE') || name.includes('SERICULTURE') || name.includes('FISHERIES') ||
    name.includes('FOOD SCI') || name.includes('DAIRY') || name.includes('NUTRITION') ||
    name.includes('DIETETICS') || name.includes('COMMUNITY SCIENCE') || name.includes('FOOD TECHNOLOGY') ||
    name.includes('FOOD TECH') || name.includes('AG. ') || name.includes('D.TECH')) {
    return 'Agriculture';
  }

  if (name.includes('AHS') || name.includes('OPERATION THEATER') || name.includes('OCCUPATIONAL') ||
    name.includes('AUDIOLOGY') || name.includes('ANAEST') || name.includes('CARDIAC') ||
    name.includes('TRAUMA') || name.includes('IMAGING') || name.includes('LAB') ||
    name.includes('NEURO') || name.includes('PERFUSION') || name.includes('RADIOTHERAPY') ||
    name.includes('RENAL') || name.includes('RESP') || name.includes('HOSP. ADMIN') ||
    name.includes('RECORD TECH') || name.includes('PUBLIC HEALTH')) {
    return 'Allied Health Sciences';
  }

  return 'Engineering';
}

async function fetchCourses() {
  const listContainer = document.getElementById('course-checkbox-list');
  if (listContainer) {
    listContainer.innerHTML = `<div style="padding: 0.5rem; font-size: 0.9rem; color: #6b7280;">Loading courses...</div>`;
  }
  selectedCourses = [];
  updateCourseTriggerText();

  try {
    if (allCourses.length === 0) {
      const res = await fetch(`${API_BASE_URL}/courses`);
      allCourses = await res.json();
    }
    appState.courses = allCourses;
    renderCourseCheckboxes();
  } catch (err) {
    if (listContainer) {
      listContainer.innerHTML = `<div style="padding: 0.5rem; font-size: 0.9rem; color: #DB4437;">Error loading courses</div>`;
    }
    Toastify({ text: "Could not load courses", style: { background: "#DB4437" } }).showToast();
  }
}

// Renders
function renderTabs() {
  tabsContainer.innerHTML = '';
  appState.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `category-tab ${appState.activeCategory === cat ? 'active' : ''}`;

    const iconName = categoryIcons[cat] || 'book-open';
    btn.innerHTML = `
      <span class="tab-icon"><i data-lucide="${iconName}" style="width: 18px; height: 18px;"></i></span>
      <span class="tab-label">${cat}</span>
    `;

    btn.addEventListener('click', () => {
      appState.activeCategory = cat;
      appState.results = [];
      resultsSection.style.display = 'none';
      resultsList.style.display = 'none';
      emptyState.style.display = 'none';
      loadingState.style.display = 'none';
      downloadBtn.style.display = 'none';

      document.getElementById('course-label').textContent = `Preferred Course (Optional)`;

      // Clear search fields and show all options
      const courseSearch = document.getElementById('course-search');
      if (courseSearch) courseSearch.value = '';
      const categorySearch = document.getElementById('category-search');
      if (categorySearch) categorySearch.value = '';
      filterCourses('');
      filterCategories('');

      const rankLabel = document.getElementById('rank-label');
      if (rankLabel) {
        rankLabel.textContent = 'Your KCET Rank';
      }

      renderTabs();

      selectedCourses = [];
      updateCourseTriggerText();
      renderCourseCheckboxes();

      if (window.lucide) {
        lucide.createIcons();
      }
    });

    tabsContainer.appendChild(btn);
  });
  if (window.lucide) {
    lucide.createIcons();
  }
}

function setQuotaRegion(region) {
  appState.quotaRegion = region;
  appState.results = [];
  appState.hasPaid = false; // Reset payment state on new search
  resultsSection.style.display = 'none';

  // Update UI for new region
  btnRk.className = `region-btn ${region === 'RK' ? 'active' : ''}`;
  btnHk.className = `region-btn ${region === 'HK' ? 'active' : ''}`;

  // Call the multi-select function to update categories
  setRegion(region);
}

// Post-Prediction Filters & Sorting
function applyPostPredictionFilters(isInitialLoad = false) {
  if (!appState.rawResults || appState.rawResults.length === 0) {
    appState.results = [];
    return;
  }

  const seatType = document.getElementById('seat-type').value;
  const district = document.getElementById('district').value;
  const sortBy = document.getElementById('sort-by').value;

  let filtered = [...appState.rawResults];

  if (seatType !== 'All') {
    filtered = filtered.filter(r => {
      const name = r.college_name.toUpperCase();
      if (seatType === 'Govt') return name.includes('GOVT') || name.includes('GOVERNMENT') || name.includes('UNIV');
      if (seatType === 'Aided') return name.includes('AIDED');
      if (seatType === 'Private') return !name.includes('GOVT') && !name.includes('GOVERNMENT') && !name.includes('UNIV') && !name.includes('AIDED');
      return true;
    });
  }

  if (district !== 'All') {
    const distUpper = district.toUpperCase();
    filtered = filtered.filter(r => {
      const name = (r.college_name || '').toUpperCase();
      if (distUpper === 'BANGALORE') return name.includes('BANGALORE') || name.includes('BENGALURU') || name.includes('BLR');
      if (distUpper === 'MYSORE') return name.includes('MYSORE') || name.includes('MYSURU');
      if (distUpper === 'MANGALORE') return name.includes('MANGALORE') || name.includes('MANGALURU');
      if (distUpper === 'HUBLI') return name.includes('HUBLI') || name.includes('DHARWAD');
      if (distUpper === 'BELGAUM') return name.includes('BELGAUM') || name.includes('BELAGAVI');
      if (distUpper === 'GULBARGA') return name.includes('GULBARGA') || name.includes('KALABURAGI');
      if (distUpper === 'TUMKUR') return name.includes('TUMKUR') || name.includes('TUMAKURU');
      if (distUpper === 'DAVANGERE') return name.includes('DAVANGERE') || name.includes('DAVANAGERE');
      if (distUpper === 'SHIMOGA') return name.includes('SHIMOGA') || name.includes('SHIVAMOGGA');
      if (distUpper === 'BELLARY') return name.includes('BELLARY') || name.includes('BALLARI');
      return name.includes(distUpper);
    });
  }

  if (sortBy === 'CutoffRank') {
    filtered.sort((a, b) => parseInt(a.cutoff_rank_num || a.cutoff_rank || 0) - parseInt(b.cutoff_rank_num || b.cutoff_rank || 0));
  } else if (sortBy === 'CollegeName') {
    filtered.sort((a, b) => (a.college_name || '').localeCompare(b.college_name || ''));
  } else if (sortBy === 'Chance') {
    const chanceOrder = { 'Safe': 1, 'Moderate': 2, 'Tough': 3 };
    filtered.sort((a, b) => {
      const chanceA = chanceOrder[a.chances] || 99;
      const chanceB = chanceOrder[b.chances] || 99;
      if (chanceA !== chanceB) {
        return chanceA - chanceB;
      }
      return parseInt(a.cutoff_rank_num || a.cutoff_rank || 0) - parseInt(b.cutoff_rank_num || b.cutoff_rank || 0);
    });
  }

  appState.results = filtered;

  if (!isInitialLoad) {
    if (appState.results.length === 0) {
      emptyState.style.display = 'flex';
      resultsList.style.display = 'none';
      downloadBtn.style.display = 'none';
      resultsTitleText.textContent = `Prediction Results (0 matched)`;
    } else {
      emptyState.style.display = 'none';
      resultsList.style.display = 'flex';
      downloadBtn.style.display = 'inline-flex';
      resultsTitleText.textContent = `Prediction Results (${appState.results.length} matched)`;
      renderResultsGrid();
    }
  }
}

// Prediction
async function handlePredict(e) {
  e.preventDefault();

  appState.rank = rankInput.value;

  if (!appState.rank || selectedCategories.length === 0) {
    Toastify({ text: "Please enter your rank and select at least one category.", style: { background: "#DB4437" } }).showToast();
    return;
  }

  // We don't reset appState.hasPaid here anymore. We evaluate it after results are fetched.

  predictBtn.disabled = true;
  predictBtn.innerHTML = 'Predicting...';
  resultsSection.style.display = 'block';
  resultsList.style.display = 'none';
  emptyState.style.display = 'none';
  loadingState.style.display = 'flex';
  resultsTitleText.textContent = `Prediction Results (Loading...)`;
  downloadBtn.style.display = 'none';

  try {
    const params = new URLSearchParams({
      rank: appState.rank,
      category: selectedCategories.join(','),
      course_category: appState.activeCategory
    });
    if (selectedCourses.length > 0) params.append('course_name', selectedCourses.join(','));

    const response = await fetch(`${API_BASE_URL}/predict?${params.toString()}`);
    let sortedResults = await response.json();

    appState.rawResults = sortedResults;
    applyPostPredictionFilters(true);

    // Check if user has already paid for this exact search in the last 24 hours
    const sig = getSearchSignature();
    const paidTimestamp = localStorage.getItem('kcet_paid_' + sig);
    if (paidTimestamp && (Date.now() - parseInt(paidTimestamp) < 24 * 60 * 60 * 1000)) {
      appState.hasPaid = true;
    } else {
      appState.hasPaid = false;
    }

    if (appState.results.length === 0) {
      emptyState.style.display = 'flex';
      loadingState.style.display = 'none';
      resultsTitleText.textContent = `Prediction Results (0 matched)`;
      Toastify({ text: "No colleges found in this range." }).showToast();
    } else {
      renderResultsGrid();
      emptyState.style.display = 'none';
      loadingState.style.display = 'none';
      resultsList.style.display = 'flex';
      downloadBtn.style.display = 'inline-flex';
      resultsTitleText.textContent = `Prediction Results (${appState.results.length} matched)`;

      if (appState.hasPaid) {
        Toastify({ text: "You previously unlocked this report. Free to download!", style: { background: "#10B981" }, duration: 4000 }).showToast();
        downloadBtn.classList.add('btn-unlocked');
        downloadBtn.title = "Your report is unlocked and ready to download.";
      } else {
        downloadBtn.classList.remove('btn-unlocked');
        downloadBtn.title = "100% Guaranteed Official PDF Report - Instant Access";
        Toastify({ text: `Found colleges!`, style: { background: "#0F9D58" } }).showToast();
      }
    }
  } catch (error) {
    console.error("Prediction error:", error);
    Toastify({ text: "Prediction failed. Please check your connection.", style: { background: "#DB4437" } }).showToast();
    loadingState.style.display = 'none';
  } finally {
    predictBtn.disabled = false;
    predictBtn.innerHTML = `<i data-lucide="search" style="width: 18px; height: 18px; margin-right: 6px;"></i> Predict Colleges`;
    if (window.lucide) {
      lucide.createIcons();
    }
  }
}

// Recent Searches History
function saveSearchToHistory() {
  const historyStr = localStorage.getItem('kcet_search_history');
  let history = historyStr ? JSON.parse(historyStr) : [];

  const currentSearch = {
    rank: appState.rank,
    quotaRegion: quotaRegion,
    activeCategory: appState.activeCategory,
    selectedCategories: [...selectedCategories],
    selectedCourses: [...selectedCourses],
    timestamp: Date.now()
  };

  // Prevent consecutive identical duplicates
  if (history.length > 0) {
    const last = history[0];
    if (last.rank === currentSearch.rank && last.activeCategory === currentSearch.activeCategory && last.selectedCategories.join(',') === currentSearch.selectedCategories.join(',')) {
      return;
    }
  }

  history.unshift(currentSearch);
  if (history.length > 5) history = history.slice(0, 5);
  localStorage.setItem('kcet_search_history', JSON.stringify(history));
  renderRecentSearches();
}

function renderRecentSearches() {
  const historyStr = localStorage.getItem('kcet_search_history');
  const section = document.getElementById('recent-downloads-section');
  const list = document.getElementById('recent-downloads-list');

  if (!historyStr || !section || !list) return;

  try {
    const history = JSON.parse(historyStr);
    if (!Array.isArray(history) || history.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = '';

    history.forEach(search => {
      try {
        const card = document.createElement('div');
        card.className = 'download-card';

        const cats = Array.isArray(search.selectedCategories) ? search.selectedCategories : [];
        const courses = Array.isArray(search.selectedCourses) ? search.selectedCourses : [];

        let catText = cats.join(', ') || 'All Categories';
        if (courses.length > 0) {
          catText += `<br/><span style="opacity: 0.8; font-size: 11px; margin-top: 2px; display: inline-block;">Courses: ${courses.join(', ')}</span>`;
        }

        card.innerHTML = `
      <div class="download-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div style="flex: 1;">
          <strong style="font-size: 14px; color: #0f172a;">Rank ${search.rank}</strong>
          <span style="color: #64748b; font-size: 12px; margin-left: 6px;">(${search.quotaRegion === 'RK' ? 'Gen' : '371j'})</span><br/>
          <span style="color: #3b82f6; font-weight: 600; font-size: 13px;">${search.activeCategory}</span>
          <div style="color: #64748b; font-size: 11px; margin-top: 4px; line-height: 1.3;">${catText}</div>
        </div>
        <button class="download-card-btn" style="padding: 6px 10px; font-size: 12px; flex-shrink: 0; white-space: nowrap;">
          <i data-lucide="download" style="width: 14px; height: 14px;"></i> Download
        </button>
      </div>
    `;

        const btn = card.querySelector('.download-card-btn');
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();

          btn.disabled = true;
          btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin" style="width: 16px; height: 16px;"></i> Generating PDF...`;
          if (window.lucide) lucide.createIcons();

          try {
            const url = new URL(`${API_BASE_URL}/predict`, window.location.origin);
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
            data.sort((a, b) => (a.cutoff_rank_num || a.cutoff_rank) - (b.cutoff_rank_num || b.cutoff_rank));

            generatePDF({
              rank: search.rank,
              selectedCategories: search.selectedCategories,
              selectedCourses: search.selectedCourses,
              activeCategory: search.activeCategory,
              results: data,
              API_BASE_URL,
              setLoadingState: (isLoading) => {
                if (!isLoading) {
                  btn.disabled = false;
                  btn.innerHTML = `<i data-lucide="download" style="width: 16px; height: 16px;"></i> Download Free`;
                  if (window.lucide) lucide.createIcons();
                }
              }
            });
          } catch (err) {
            console.error("Silent PDF download failed:", err);
            Toastify({ text: "Failed to generate report. Please try again.", style: { background: "#DB4437" } }).showToast();
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="download" style="width: 16px; height: 16px;"></i> Download Free`;
            if (window.lucide) lucide.createIcons();
          }
        });

        card.appendChild(btn);
        list.appendChild(card);
      } catch (err) {
        console.error("Error rendering a history card:", err);
      }
    });
  } catch (err) {
    console.error("Error parsing recent searches:", err);
    localStorage.removeItem('kcet_search_history'); // Clear corrupted data
    section.style.display = 'none';
  }

  if (window.lucide) lucide.createIcons();
}

function renderResultsGrid() {
  let html = `
    <div class="list-header-row">
      <div>College Name</div>
      <div>Course</div>
      <div>Cutoff</div>
      <div>Year/Rnd</div>
      <div>Chance</div>
    </div>
  `;

  // Display only the first 3 results to hook them
  const displayResults = appState.results.slice(0, 3);

  displayResults.forEach(result => {
    html += `
      <a href="#" class="list-row" onclick="event.preventDefault()">
        <div class="cell-name"><span style="color: #0F9D58; font-weight: 600; font-size: 0.9em;">[${result.college_code}]</span> ${result.college_name}</div>
        <div class="cell-course">
          <i data-lucide="book-open" style="width: 14px; height: 14px; margin-right: 4px;"></i>
          ${result.course_name}
        </div>
        <div class="cell-cutoff">${result.cutoff_rank_num || result.cutoff_rank}</div>
        <div class="cell-year">${result.year} / R${result.round}</div>
        <div>
          <span class="badge ${result.chances}">${result.chances}</span>
        </div>
      </a>
    `;
  });

  // THE FOMO/FEAR HOOK: Tell them exactly what they are missing out on.
  if (appState.results.length > 3) {
    const hiddenCount = appState.results.length - 3;
    html += `
      <div class="fear-lock-box">
          <img src="/kcet/images/open-lock.gif" alt="Open Lock" style="width: 100px; height: 100px;"> 
        <div style="font-weight: 800; font-size: 18px; margin-bottom: 8px; color: #1E293B;">
           ${hiddenCount} More College Matches Hidden
        </div>
        <div style="font-size: 14px; color: #64748B; margin-bottom: 12px; max-width: 400px; margin-left: auto; margin-right: auto;">
          Do not guess your Option Entry. Download the mathematically optimized PDF report to guarantee your seat.
        </div>
        
        <div class="fear-features">
            <div class="fear-feature-item">
                <i data-lucide="check-circle" style="width: 16px;"></i> Reveals Hidden SNQ / Fee-Waiver Colleges
            </div>
            <div class="fear-feature-item">
                <i data-lucide="check-circle" style="width: 16px;"></i> Copy-Paste Ready KEA Option Entry Priority List
            </div>
            <div class="fear-feature-item">
                <i data-lucide="check-circle" style="width: 16px;"></i> Placement ROI & Fee vs Salary Matrix
            </div>
            <div class="fear-feature-item" style="color: #EF4444;">
                <i data-lucide="alert-circle" style="width: 16px; color: #EF4444;"></i> Strict Document Verification Checklist (Avoid Rejection)
            </div>
        </div>
      </div>
    `;
  }

  resultsList.innerHTML = html;

  // Show the KEA Trap Warning Alert now that results have loaded
  document.getElementById('kea-warning-alert').style.display = 'flex';

  // Randomize Scarcity Slots left (between 4 and 18) to create dynamic urgency
  document.getElementById('slots-left').innerText = Math.floor(Math.random() * (18 - 4 + 1)) + 4;

  if (window.lucide) {
    lucide.createIcons();
  }
}

// Razorpay Integration
async function handleDownloadPayment() {
  if (appState.results.length === 0) return;

  if (appState.hasPaid) {
    Toastify({ text: "Generating your PDF...", style: { background: "#0F9D58" } }).showToast();
    triggerPDFDownload();
    return;
  }

  const token = localStorage.getItem('kcet_jwt_token');

  // Check if Pro/Ultra Pro subscription exists and has downloads left
  if (appState.user && (appState.user.subscriptionType === 'Pro' || appState.user.subscriptionType === 'Ultra Pro') && appState.user.pdfDownloadsLeft > 0) {
    downloadBtn.disabled = true;
    downloadText.textContent = "Checking Credits...";
    Toastify({ text: "Using your subscription credit...", style: { background: "#4F46E5" } }).showToast();
    
    try {
      const subDownloadRes = await fetch('/kcet/api/payment/subscription-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (subDownloadRes.ok) {
        const subData = await subDownloadRes.json();
        
        // Update user downloads left in state & storage
        appState.user.pdfDownloadsLeft = subData.pdfDownloadsLeft;
        appState.user.pdfDownloadsUsed = subData.pdfDownloadsUsed;
        localStorage.setItem('kcet_user', JSON.stringify(appState.user));
        
        // Unlock download
        appState.hasPaid = true;
        localStorage.setItem('kcet_paid_' + getSearchSignature(), Date.now().toString());
        saveSearchToHistory();
        
        downloadBtn.classList.add('btn-unlocked');
        downloadBtn.title = "Your report is unlocked via subscription credit.";
        Toastify({ text: "Report Unlocked! Generating PDF...", style: { background: "#0F9D58" } }).showToast();
        
        triggerPDFDownload();
        await checkAuth(); // refresh dashboard downloads left count
        return;
      } else {
        const errData = await subDownloadRes.json();
        console.warn('Subscription download consumption failed:', errData.error);
        // Fallback to normal payment flow
      }
    } catch (err) {
      console.error('Subscription download error:', err);
      // Fallback to normal payment flow
    }
  }

  downloadBtn.disabled = true;
  downloadText.textContent = "Processing Payment...";

  try {
    // Calculate dynamic price
    const dynamicPrice = calculateDynamicPrice();

    const orderRes = await fetch('/kcet/api/payment/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categories: selectedCategories,
        courses: selectedCourses,
        couponCode: appState.appliedCoupon
      })
    });

    if (!orderRes.ok) throw new Error("Failed to create order");

    const order = await orderRes.json();

    // Check if order is free (coupon admin100 applied)
    if (order.isFree) {
      try {
        // GUARANTEE 100% DELIVERY: Instantly unlock PDF without waiting for server verification
        appState.hasPaid = true;
        localStorage.setItem('kcet_paid_' + getSearchSignature(), Date.now().toString());
        saveSearchToHistory(); // Only save to recent searches after payment success
        downloadBtn.classList.add('btn-unlocked');
        downloadBtn.title = "Your report is unlocked and ready to download.";
        Toastify({ text: "Access Unlocked! Generating PDF...", style: { background: "#0F9D58" } }).showToast();
        triggerPDFDownload();

        // Send verification to server asynchronously in the background
        fetch('/kcet/api/payment/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: order.id,
            razorpay_payment_id: 'free_payment_admin100',
            razorpay_signature: 'free_sig_admin100',
            categories: selectedCategories,
            courses: selectedCourses,
            couponCode: appState.appliedCoupon
          })
        }).catch(err => console.error("Background verify failed:", err));

      } catch (err) {
        console.error(err);
        downloadBtn.disabled = false;
        downloadText.textContent = "Unlock Full Report (FREE)";
      }
      return;
    }

    const rzpKey = document.getElementById('rzp-key').value;

    const options = {
      key: rzpKey,
      amount: order.amount,
      currency: order.currency,
      name: "KCET Predictor",
      description: "KCET Cutoff PDF Report",
      order_id: order.id,
      handler: async function (response) {
        // Payment successful callback
        try {
          // GUARANTEE 100% DELIVERY: If Razorpay widget says success, immediately give PDF
          appState.hasPaid = true;
          localStorage.setItem('kcet_paid_' + getSearchSignature(), Date.now().toString());
          saveSearchToHistory(); // Only save to recent searches after payment success
          downloadBtn.classList.add('btn-unlocked');
          downloadBtn.title = "Your report is unlocked and ready to download.";
          Toastify({ text: "Payment Successful! Generating PDF...", style: { background: "#0F9D58" } }).showToast();
          triggerPDFDownload();

          // Asynchronously verify payment with the server in the background
          // This prevents server timeouts or verification bugs from blocking the PDF
          fetch('/kcet/api/payment/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              categories: selectedCategories,
              courses: selectedCourses
            })
          }).catch(err => console.error("Background verify failed:", err));

        } catch (err) {
          console.error(err);
          downloadBtn.disabled = false;
          downloadText.textContent = `Unlock Full Report (₹${dynamicPrice})`;
        }
      },
      prefill: {
        name: "Student",
        email: "kea.vidyari@gmail.com",
        contact: "8880870645"
      },
      theme: {
        color: "#1A73E8"
      },
      modal: {
        ondismiss: function () {
          downloadBtn.disabled = false;
          downloadText.textContent = `Unlock Full Report (₹${dynamicPrice})`;
          Toastify({ text: "Payment Cancelled", style: { background: "#F4B400" } }).showToast();
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function (response) {
      Toastify({ text: "Payment Failed", style: { background: "#DB4437" } }).showToast();
      downloadBtn.disabled = false;
      downloadText.textContent = `Unlock Full Report (₹${dynamicPrice})`;
    });

    rzp.open();
  } catch (err) {
    console.error(err);
    Toastify({ text: "Failed to initiate payment.", style: { background: "#DB4437" } }).showToast();
    downloadBtn.disabled = false;
    downloadText.textContent = "Unlock Full Report (₹99)";
  }
}

function triggerPDFDownload() {
  const setPdfLoadingState = (isLoading) => {
    downloadBtn.disabled = isLoading;
    if (appState.hasPaid) {
      downloadText.textContent = isLoading ? 'Generating PDF...' : 'Download PDF Manually';
    } else {
      downloadText.textContent = isLoading ? 'Generating PDF...' : `Unlock Full Report (₹${calculateDynamicPrice()})`;
    }

    const overlay = document.getElementById('pdf-loading-overlay');
    if (overlay) {
      if (isLoading) {
        overlay.style.display = 'flex';
        setTimeout(() => overlay.classList.add('visible'), 10);
      } else {
        overlay.classList.remove('visible');
        setTimeout(() => { overlay.style.display = 'none'; }, 400);
      }
    }
  };

  generatePDF({
    rank: appState.rank,
    selectedCategories: selectedCategories,
    selectedCourses: selectedCourses,
    activeCategory: appState.activeCategory,
    results: appState.rawResults || appState.results,
    API_BASE_URL,
    setLoadingState: setPdfLoadingState
  });
}
// --- LIVE SOCIAL PROOF NOTIFICATION LOGIC ---

const mockPurchases = [
  { name: "Rahul", location: "Bengaluru", time: "Just now" },
  { name: "Sneha", location: "Mysuru", time: "1 min ago" },
  { name: "Karthik", location: "Hubballi", time: "2 mins ago" },
  { name: "Ananya", location: "Mangaluru", time: "Just now" },
  { name: "Prajwal", location: "Davanagere", time: "3 mins ago" },
  { name: "Meghana", location: "Belagavi", time: "1 min ago" },
  { name: "Darshan", location: "Shivamogga", time: "4 mins ago" },
  { name: "Spoorthi", location: "Udupi", time: "Just now" },
  { name: "Varun", location: "Tumakuru", time: "2 mins ago" },
  { name: "Bhoomika", location: "Hassan", time: "5 mins ago" },
  { name: "Manoj", location: "Ballari", time: "1 min ago" },
  { name: "Rachita", location: "Kalaburagi", time: "3 mins ago" },
  { name: "Gagan", location: "Bengaluru", time: "Just now" },
  { name: "Nandini", location: "Bidar", time: "6 mins ago" },
  { name: "Suhas", location: "Raichur", time: "2 mins ago" },
  { name: "Kavya", location: "Vijayapura", time: "4 mins ago" },
  { name: "Chetan", location: "Chitradurga", time: "Just now" },
  { name: "Aishwarya", location: "Chikkamagaluru", time: "1 min ago" },
  { name: "Yash", location: "Gadag", time: "3 mins ago" },
  { name: "Pooja", location: "Kolar", time: "2 mins ago" }
];

function initSocialProof() {
  const toastEl = document.getElementById('social-proof-toast');
  const userEl = document.getElementById('toast-user');
  const timeEl = document.getElementById('toast-time');

  if (!toastEl) return;

  function showRandomToast() {
    // Pick a random user
    const randomUser = mockPurchases[Math.floor(Math.random() * mockPurchases.length)];

    // Update DOM
    userEl.textContent = `${randomUser.name} from ${randomUser.location}`;
    timeEl.textContent = randomUser.time;

    // Re-initialize Lucide icons just in case
    if (window.lucide) {
      lucide.createIcons();
    }

    // Show the toast
    toastEl.classList.add('show');

    // Hide it after 4 seconds
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, 4000);

    // Schedule the next one randomly between 8 to 18 seconds from now
    const nextTime = Math.floor(Math.random() * (18000 - 8000 + 1) + 8000);
    setTimeout(showRandomToast, nextTime);
  }

  // Start the first notification 5 seconds after the page loads
  setTimeout(showRandomToast, 2000);
}

// Start the social proof engine

// Start
init();
initSocialProof();

