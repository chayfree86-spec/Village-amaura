// app.js - Frontend Logic for Prajapati Ekta Group

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => {
                console.log('Service Worker registered successfully:', reg.scope);
                // Listen for updates
                reg.onupdatefound = () => {
                    const installingWorker = reg.installing;
                    if (installingWorker) {
                        installingWorker.onstatechange = () => {
                            if (installingWorker.state === 'installed') {
                                if (navigator.serviceWorker.controller) {
                                    console.log('New update installed, reloading page...');
                                    window.location.reload();
                                }
                            }
                        };
                    }
                };
            })
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

// Global error handler for debugging
window.onerror = function (msg, url, lineNo, columnNo, error) {
    console.error("JS Error: " + msg + "\nLine: " + lineNo + "\nFile: " + url, error);
    return false;
};

// State Variables
let appData = {
    dashboard: { total_cash: 0, total_goods: 0, total_collection: 0, total_expense: 0, current_balance: 0 },
    edit_locked: false,
    feed: [],
    contributions: [],
    expenses: [],
    members: []
};

let currentUser = JSON.parse(localStorage.getItem('prajapati_user')) || null;
let currentActivePage = 'page-dashboard';
let pollInterval = null;
let reportFilters = {
    year: 'all',
    month: 'all',
    type: 'all'
};
let base64BillImage = "";

// Custom Calendar State
let calendarState = {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(), // 0-indexed
    activeInputId: null,
    activeContainerId: null
};

// Hindi Month Names
const hindiMonths = [
    'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 
    'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
];

// Document Ready
document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initAuth();
    initExpenseModal();
    initDropdowns();
    initCalendars();
    initCalculations();
    initAddContributionModal();
    initFormSubmits();
    initExportActions();
    initAdminToggle();
    initReportFilters();
    
    // Start AJAX Polling
    fetchLiveData();
    pollInterval = setInterval(fetchLiveData, 3000);

    // Initialize Search
    initUniversalSearch();
    initVoiceSearch();
});

// ================= NAVIGATION =================
function initNavigation() {
    const navButtons = document.querySelectorAll(".nav-item");
    const pages = document.querySelectorAll(".page-view");
    
    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-target");
            
            // UI Update
            navButtons.forEach(b => {
                b.classList.remove("text-riverBlue");
                b.classList.add("text-slate-400");
            });
            btn.classList.add("text-riverBlue");
            btn.classList.remove("text-slate-400");
            
            // Switch Pages
            pages.forEach(p => p.classList.remove("active"));
            const targetPage = document.getElementById(target);
            if (targetPage) {
                targetPage.classList.add("active");
                currentActivePage = target;
                
                // Scroll to top of the page on tab switch
                window.scrollTo({ top: 0, behavior: 'instant' });
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
                
                // Toggle body height and overflow to prevent scrolling the outer page on the Member tab
                const mainEl = document.querySelector("main");
                if (target === 'page-members') {
                    document.body.classList.add("h-screen", "overflow-hidden");
                    if (mainEl) {
                        mainEl.classList.add("overflow-hidden");
                        mainEl.style.paddingBottom = "0px";
                    }
                } else {
                    document.body.classList.remove("h-screen", "overflow-hidden");
                    if (mainEl) {
                        mainEl.classList.remove("overflow-hidden");
                        mainEl.style.paddingBottom = "";
                    }
                }
                
                // Clear search input on navigation
                const searchInput = document.getElementById("universalSearchInput");
                if (searchInput) {
                    searchInput.value = "";
                    // Reset all filters
                    filterListCards("tabMembersListContainer", "");
                    filterListCards("membersListContainer", "");
                    filterListCards("transactionsList", "");
                    filterListCards("recentActivityFeed", "");
                }
                
                // Extra actions depending on page
                if (target === 'page-reports') {
                    renderFilteredReport();
                }
            }
        });
    });
}

// ================= EXPENSE MODAL CONTROLS =================
function initExpenseModal() {
    const addExpenseFab = document.getElementById("addExpenseFab");
    const expenseModal = document.getElementById("expenseModal");
    const closeExpenseModal = document.getElementById("closeExpenseModal");

    if (addExpenseFab && expenseModal && closeExpenseModal) {
        addExpenseFab.addEventListener("click", () => {
            if (!currentUser) {
                alert("खर्च जोड़ने के लिए कृपया पहले लॉगिन करें।");
                return;
            }
            // Reset for Add mode
            const expForm = document.getElementById("expenseForm");
            if (expForm) {
                expForm.reset();
                expForm.removeAttribute("data-keep-image");
            }
            const expIdEl = document.getElementById("expId");
            if (expIdEl) expIdEl.value = "";
            
            const expTitleEl = document.getElementById("expenseModalTitle");
            if (expTitleEl) expTitleEl.innerText = "💸 नया खर्च (Expense) दर्ज करें";
            
            const expSubmitBtn = document.querySelector("#expenseForm button[type='submit']");
            if (expSubmitBtn) expSubmitBtn.innerText = "खर्च सुरक्षित करें";
            
            const billFileNameLabel = document.getElementById("billFileName");
            const clearBillBtn = document.getElementById("clearBillBtn");
            if (billFileNameLabel) billFileNameLabel.innerText = "फोटो अपलोड करें";
            if (clearBillBtn) clearBillBtn.classList.add("hidden");
            
            base64BillImage = "";
            
            // Set date to today
            const expDateEl = document.getElementById("expDate");
            if (expDateEl) expDateEl.value = getFormattedDate(new Date());

            expenseModal.classList.remove("hidden");
        });

        closeExpenseModal.addEventListener("click", () => {
            expenseModal.classList.add("hidden");
        });

        // Close on click outside modal content
        expenseModal.addEventListener("click", (e) => {
            if (e.target === expenseModal) {
                expenseModal.classList.add("hidden");
            }
        });
    }
}

// ================= AUTHENTICATION =================
function initAuth() {
    const authBtn = document.getElementById("headerAuthBtn");
    const loginModal = document.getElementById("loginModal");
    const closeLoginBtn = document.getElementById("closeLoginModal");
    const loginForm = document.getElementById("loginForm");
    const logoutBtn = document.getElementById("logoutBtn");

    if (authBtn) {
        authBtn.addEventListener("click", () => {
            if (currentUser) {
                // If logged in, navigate to Settings page where they can see details / logout
                const settingsBtn = document.querySelector('[data-target="page-settings"]');
                if (settingsBtn) settingsBtn.click();
            } else {
                if (loginModal) loginModal.classList.remove("hidden");
            }
        });
    }

    if (closeLoginBtn && loginModal) {
        closeLoginBtn.addEventListener("click", () => {
            loginModal.classList.add("hidden");
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const mobileInput = document.getElementById("loginMobile");
            const passwordInput = document.getElementById("loginPassword");
            if (!mobileInput || !passwordInput) return;

            const mobile = mobileInput.value.trim();
            const password = passwordInput.value.trim();

            if (mobile.length !== 10) {
                alert("कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें।");
                return;
            }

            fetch('api.php?action=login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mobile, password })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    currentUser = data.user;
                    localStorage.setItem('prajapati_user', JSON.stringify(currentUser));
                    if (loginModal) loginModal.classList.add("hidden");
                    loginForm.reset();
                    updateAuthUI();
                    fetchLiveData(); // Refresh state immediately
                    alert("सफलतापूर्वक लॉगिन किया गया!");
                } else {
                    alert(data.error || "लॉगिन विफल!");
                }
            })
            .catch(err => {
                console.error(err);
                alert("लॉगिन के दौरान त्रुटि हुई।");
            });
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            currentUser = null;
            localStorage.removeItem('prajapati_user');
            updateAuthUI();
            fetchLiveData();
            const dashBtn = document.querySelector('[data-target="page-dashboard"]');
            if (dashBtn) dashBtn.click();
            alert("सफलतापूर्वक लॉगआउट किया गया!");
        });
    }

    updateAuthUI();
}

function updateAuthUI() {
    const authBtn = document.getElementById("headerAuthBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const settingsAddMemberSection = document.getElementById("settingsAddMemberSection");
    const adminControlsCard = document.getElementById("adminControlsCard");
    const profileDetailsContainer = document.getElementById("profileDetailsContainer");

    if (currentUser) {
        // Authenticated UI
        if (authBtn) authBtn.innerHTML = `<span class="material-icons-outlined">person</span>`;
        if (logoutBtn) logoutBtn.classList.remove("hidden");
        
        // Settings page profile info
        if (profileDetailsContainer) {
            profileDetailsContainer.innerHTML = `
                <div class="flex justify-between items-center border-b border-lightGray pb-2">
                    <span class="text-xs text-slate-500">नाम (Name):</span>
                    <span class="text-sm font-medium text-slate-800">${currentUser.name}</span>
                </div>
                <div class="flex justify-between items-center border-b border-lightGray pb-2">
                    <span class="text-xs text-slate-500">मोबाइल (Mobile):</span>
                    <span class="text-sm font-medium text-slate-800">${currentUser.mobile}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-xs text-slate-500">पद (Role):</span>
                    <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${currentUser.is_admin ? 'bg-riverBlue/10 text-riverBlue' : 'bg-natureGreen/10 text-natureGreen'}">
                        ${currentUser.is_admin ? 'एडमिन (Admin)' : 'सामान्य सदस्य (Member)'}
                    </span>
                </div>
            `;
        }

        // Show add member section in settings to logged in users
        if (settingsAddMemberSection) settingsAddMemberSection.classList.remove("hidden");

        if (currentUser.is_admin === 1) {
            // Admin only features
            if (adminControlsCard) adminControlsCard.classList.remove("hidden");
        } else {
            if (adminControlsCard) adminControlsCard.classList.add("hidden");
        }
    } else {
        // Guest UI
        if (authBtn) authBtn.innerHTML = `<span class="material-icons-outlined">login</span>`;
        if (logoutBtn) logoutBtn.classList.add("hidden");
        if (settingsAddMemberSection) settingsAddMemberSection.classList.add("hidden");
        if (adminControlsCard) adminControlsCard.classList.add("hidden");
        if (profileDetailsContainer) {
            profileDetailsContainer.innerHTML = `
                <div class="text-center text-slate-400 py-2 text-xs flex flex-col items-center gap-2">
                    <span>आप वर्तमान में लॉगिन नहीं हैं।</span>
                    <button onclick="document.getElementById('loginModal').classList.remove('hidden')" class="bg-riverBlue text-white px-4 py-1.5 rounded-xl text-xs font-medium">
                        लॉगिन करें
                    </button>
                </div>
            `;
        }
    }
}

// ================= CUSTOM DROPDOWNS =================
function initDropdowns() {
    // 1. Add Contribution Type Dropdown
    setupCustomDropdown(
        "dropdownAddTypeBtn", 
        "dropdownAddTypeList", 
        "dropdownAddTypeValue", 
        (val) => {
            const cashFields = document.getElementById("addCashFields");
            const goodsFields = document.getElementById("addGoodsFields");
            if (cashFields && goodsFields) {
                if (val === 'cash') {
                    cashFields.classList.remove("hidden");
                    goodsFields.classList.add("hidden");
                } else {
                    cashFields.classList.add("hidden");
                    goodsFields.classList.remove("hidden");
                }
            }
        }
    );

    // 2. Add Contribution Payment Mode Dropdown
    setupCustomDropdown("dropdownAddModeBtn", "dropdownAddModeList", "dropdownAddModeValue");

    // 3. Edit Contribution Type Dropdown
    setupCustomDropdown(
        "dropdownEditTypeBtn", 
        "dropdownEditTypeList", 
        "dropdownEditTypeValue", 
        (val) => {
            const cashFields = document.getElementById("editCashFields");
            const goodsFields = document.getElementById("editGoodsFields");
            if (cashFields && goodsFields) {
                if (val === 'cash') {
                    cashFields.classList.remove("hidden");
                    goodsFields.classList.add("hidden");
                } else {
                    cashFields.classList.add("hidden");
                    goodsFields.classList.remove("hidden");
                }
            }
        }
    );

    // 4. Edit Contribution Payment Mode Dropdown
    setupCustomDropdown("dropdownEditModeBtn", "dropdownEditModeList", "dropdownEditModeValue");

    // 5. General Add Contribution Member Dropdown
    setupCustomDropdown("dropdownAddMemberBtn", "dropdownAddMemberList", "dropdownAddMemberValue");
}

function setupCustomDropdown(btnId, listId, valueSpanId, onChangeCallback = null) {
    const btn = document.getElementById(btnId);
    const list = document.getElementById(listId);
    const valSpan = document.getElementById(valueSpanId);

    if (!btn || !list) return;

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        // Close other dropdowns first
        document.querySelectorAll("[id$='List']").forEach(el => {
            if (el.id !== listId) el.classList.add("hidden");
        });
        list.classList.toggle("hidden");
    });

    list.querySelectorAll("[data-value]").forEach(item => {
        item.addEventListener("click", (e) => {
            e.stopPropagation();
            const val = item.getAttribute("data-value");
            if (valSpan) valSpan.innerHTML = item.innerHTML;
            btn.setAttribute("data-selected-value", val);
            list.classList.add("hidden");
            
            if (onChangeCallback) {
                onChangeCallback(val);
            }
        });
    });

    // Close on click outside
    document.addEventListener("click", () => {
        list.classList.add("hidden");
    });
}

// ================= CUSTOM CALENDARS =================
function initCalendars() {
    // Set current date in inputs on load
    const todayStr = getFormattedDate(new Date());
    const addContDateInput = document.getElementById("addContDate");
    const expDateInput = document.getElementById("expDate");
    if (addContDateInput) addContDateInput.value = todayStr;
    if (expDateInput) expDateInput.value = todayStr;

    setupCustomCalendar("addContDate", "customCalendarContainerAddCont", "prevMonthBtnAddCont", "nextMonthBtnAddCont", "calendarMonthYearAddCont", "calendarDaysGridAddCont");
    setupCustomCalendar("expDate", "customCalendarContainerExpense", "prevMonthBtnExp", "nextMonthBtnExp", "calendarMonthYearExp", "calendarDaysGridExp");
    setupCustomCalendar("editContDate", "customCalendarContainerEditCont", "prevMonthBtnEditCont", "nextMonthBtnEditCont", "calendarMonthYearEditCont", "calendarDaysGridEditCont");
}

function getFormattedDate(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
}

function setupCustomCalendar(inputId, containerId, prevBtnId, nextBtnId, labelId, gridId) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(containerId);
    const prevBtn = document.getElementById(prevBtnId);
    const nextBtn = document.getElementById(nextBtnId);
    const label = document.getElementById(labelId);
    const grid = document.getElementById(gridId);

    if (!input || !container || !prevBtn || !nextBtn || !label || !grid) return;

    // Initial state setup
    let calYear = new Date().getFullYear();
    let calMonth = new Date().getMonth();

    // Toggle calendar on click input
    input.addEventListener("click", (e) => {
        e.stopPropagation();
        // Hide other calendars & dropdowns
        document.querySelectorAll("[id^='customCalendarContainer']").forEach(c => {
            if (c.id !== containerId) c.classList.add("hidden");
        });
        document.querySelectorAll("[id$='List']").forEach(el => el.classList.add("hidden"));

        container.classList.toggle("hidden");
        renderCalendarDays(calYear, calMonth, input, container, label, grid);
    });

    // Previous Month Click
    prevBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        calMonth--;
        if (calMonth < 0) {
            calMonth = 11;
            calYear--;
        }
        renderCalendarDays(calYear, calMonth, input, container, label, grid);
    });

    // Next Month Click
    nextBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        calMonth++;
        if (calMonth > 11) {
            calMonth = 0;
            calYear++;
        }
        renderCalendarDays(calYear, calMonth, input, container, label, grid);
    });

    // Close on click outside
    document.addEventListener("click", (e) => {
        if (!container.contains(e.target) && e.target !== input) {
            container.classList.add("hidden");
        }
    });
}

function renderCalendarDays(year, month, inputEl, containerEl, labelEl, gridEl) {
    if (!labelEl || !gridEl) return;
    labelEl.innerText = `${hindiMonths[month]} ${year}`;
    gridEl.innerHTML = '';

    // First day of the month
    const firstDay = new Date(year, month, 1).getDay();
    // Days in the month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Render empty slots for weekdays offset
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "py-1.5";
        gridEl.appendChild(emptyCell);
    }

    // Render days
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement("div");
        dayCell.innerText = day;
        
        let isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
        
        // Selection/Highlight Styling
        let baseClass = "py-1.5 rounded-full cursor-pointer hover:bg-riverBlue/10 transition-colors flex items-center justify-center font-medium ";
        if (isToday) {
            baseClass += "bg-natureGreen/15 text-natureGreen border border-natureGreen/30 ";
        }
        
        dayCell.className = baseClass;
        
        dayCell.addEventListener("click", (e) => {
            e.stopPropagation();
            const d = String(day).padStart(2, '0');
            const m = String(month + 1).padStart(2, '0');
            inputEl.value = `${d}-${m}-${year}`;
            containerEl.classList.add("hidden");
        });

        gridEl.appendChild(dayCell);
    }
}

// ================= CALCULATIONS (GOODS AUTO TOTAL) =================
function initCalculations() {
    const qtyInput = document.getElementById("goodsQty");
    const rateInput = document.getElementById("goodsRate");
    const totalDiv = document.getElementById("goodsAutoTotal");

    if (!qtyInput || !rateInput || !totalDiv) return;

    function calculateTotal() {
        const qty = parseFloat(qtyInput.value) || 0;
        const rate = parseFloat(rateInput.value) || 0;
        const total = qty * rate;
        totalDiv.innerText = `₹ ${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    qtyInput.addEventListener("input", calculateTotal);
    rateInput.addEventListener("input", calculateTotal);
}

// ================= AJAX REAL-TIME SYNC =================
function fetchLiveData() {
    const syncIndicator = document.getElementById("syncIndicator");
    if (syncIndicator) syncIndicator.classList.remove("hidden");

    fetch('api.php?action=get_data')
    .then(res => res.json())
    .then(data => {
        if (syncIndicator) syncIndicator.classList.add("hidden");
        if (data.success) {
            appData = data;
            renderDashboard();
            renderActivityFeed();
            renderContributionsList();
            renderFilteredReport();
            renderMembersList();
            
            // Sync Admin Controls states
            const adminLockEditToggle = document.getElementById("adminLockEditToggle");
            if (adminLockEditToggle) adminLockEditToggle.checked = data.edit_locked;
        }
    })
    .catch(err => {
        if (syncIndicator) syncIndicator.classList.add("hidden");
        console.error("Sync error:", err);
    });
}

function renderDashboard() {
    const d = appData.dashboard;
    if (!d) return;
    
    const cashEl = document.getElementById("dashTotalCash");
    const goodsEl = document.getElementById("dashTotalGoods");
    const collEl = document.getElementById("dashTotalCollection");
    const expEl = document.getElementById("dashTotalExpense");
    const balanceEl = document.getElementById("dashCurrentBalance");

    if (cashEl) cashEl.innerText = `₹ ${d.total_cash.toLocaleString('en-IN')}`;
    if (goodsEl) goodsEl.innerText = `₹ ${d.total_goods.toLocaleString('en-IN')}`;
    if (collEl) collEl.innerText = `₹ ${d.total_collection.toLocaleString('en-IN')}`;
    if (expEl) expEl.innerText = `₹ ${d.total_expense.toLocaleString('en-IN')}`;
    
    if (balanceEl) {
        balanceEl.innerText = `₹ ${d.current_balance.toLocaleString('en-IN')}`;
        
        // Color code balance text if negative/positive for dark green background compatibility
        if (d.current_balance < 0) {
            balanceEl.classList.add("text-red-300");
            balanceEl.classList.remove("text-white", "text-riverBlue", "text-softRed");
        } else {
            balanceEl.classList.add("text-white");
            balanceEl.classList.remove("text-red-300", "text-riverBlue", "text-softRed");
        }
    }
}

function formatDateDisplay(dateStr) {
    // Format YYYY-MM-DD to DD-MM-YYYY
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

function renderActivityFeed() {
    const container = document.getElementById("recentActivityFeed");
    if (!container) return;
    container.innerHTML = '';

    if (appData.feed.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-6 text-xs">कोई गतिविधि नहीं मिली</div>`;
        return;
    }

    appData.feed.forEach(item => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "flex items-start gap-3 text-[13px] pb-3 border-b border-lightGray/80 last:border-b-0";

        let icon = '';
        let title = '';
        let subtitle = '';
        let amountStr = '';

        if (item.feed_type === 'contribution') {
            if (item.type === 'cash') {
                icon = `<span class="material-icons-outlined text-riverBlue bg-riverBlue/10 p-1.5 rounded-full text-lg">waves</span>`;
                title = `<span class="font-medium text-slate-700">${item.name}</span> ने नकद योगदान दिया`;
                subtitle = item.item_name ? `📝 ${item.item_name}` : '💰 नकद दान';
                amountStr = `<span class="text-riverBlue font-semibold text-right block">+₹${item.amount.toLocaleString('en-IN')}</span>`;
            } else {
                icon = `<span class="material-icons-outlined text-natureGreen bg-natureGreen/10 p-1.5 rounded-full text-lg">grass</span>`;
                title = `<span class="font-medium text-slate-700">${item.name}</span> ने सामग्री योगदान दिया`;
                subtitle = `🏗️ ${item.item_name}`;
                amountStr = `<span class="text-natureGreen font-semibold text-right block">+₹${item.total_value.toLocaleString('en-IN')}</span>`;
            }
        } else {
            // Expense
            icon = `<span class="material-icons-outlined text-softRed bg-softRed/10 p-1.5 rounded-full text-lg">payments</span>`;
            title = `💸 <span class="font-medium text-slate-700">${item.name}</span> को भुगतान किया गया`;
            subtitle = `📝 ${item.item_name || 'खर्च'}`;
            amountStr = `<span class="text-softRed font-semibold text-right block">-₹${item.amount.toLocaleString('en-IN')}</span>`;
        }

        itemDiv.innerHTML = `
            <div class="flex-shrink-0">${icon}</div>
            <div class="flex-1 min-w-0">
                <div class="text-slate-600 truncate">${title}</div>
                <div class="text-xs text-slate-400 mt-0.5">${subtitle}</div>
                <div class="text-[11px] text-slate-400 mt-0.5">📅 ${formatDateDisplay(item.date)}</div>
            </div>
            <div class="flex-shrink-0 ml-2">${amountStr}</div>
        `;
        container.appendChild(itemDiv);
    });
}

function renderContributionsList() {
    const container = document.getElementById("contributionsList");
    if (!container) return;
    container.innerHTML = '';

    const countEl = document.getElementById("totalContributionsCount");
    if (countEl) countEl.innerText = `कुल प्रविष्टियां: ${appData.contributions.length}`;

    if (appData.contributions.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-8 text-xs">कोई योगदान नहीं मिला</div>`;
        return;
    }

    appData.contributions.forEach(c => {
        const card = document.createElement("div");
        card.className = "bg-white p-4 rounded-2xl shadow-sm border border-sandBeige/20 relative flex flex-col justify-between";

        let mainInfo = '';
        let detailsInfo = '';
        let isGoods = c.type === 'goods';

        if (!isGoods) {
            mainInfo = `
                <div class="flex items-center gap-1.5">
                    <span class="material-icons-outlined text-riverBlue text-base">waves</span>
                    <span class="font-medium text-slate-700 text-[15px]">${c.name}</span>
                </div>
                <span class="text-base font-semibold text-riverBlue">₹${c.amount.toLocaleString('en-IN')}</span>
            `;
            detailsInfo = `
                <div class="text-slate-500 text-[13px]">💰 नकद दान: ${c.payment_mode === 'upi' ? 'UPI' : (c.payment_mode === 'bank' ? 'बैंक ट्रांसफर' : 'नकद')}</div>
            `;
        } else {
            mainInfo = `
                <div class="flex items-center gap-1.5">
                    <span class="material-icons-outlined text-natureGreen text-base">grass</span>
                    <span class="font-medium text-slate-700 text-[15px]">${c.name}</span>
                </div>
                <span class="text-base font-semibold text-natureGreen">₹${c.total_value.toLocaleString('en-IN')}</span>
            `;
            detailsInfo = `
                <div class="text-slate-500 text-[13px]">🏗️ सामग्री: ${c.item_name}</div>
                <div class="text-xs text-slate-400 mt-0.5">📦 मात्रा: ${c.quantity} | दर: ₹${c.rate}</div>
            `;
        }

        // Show delete button only if admin OR edit mode unlocked
        const canDelete = currentUser && (currentUser.is_admin === 1 || !appData.edit_locked);
        const deleteBtn = canDelete ? `
            <button onclick="handleDelete(${c.id}, 'contribution')" class="text-softRed/70 hover:text-softRed p-1 rounded-full hover:bg-softRed/5 transition-colors absolute top-3 right-3">
                <span class="material-icons-outlined text-md">delete</span>
            </button>
        ` : '';

        card.innerHTML = `
            ${deleteBtn}
            <div class="flex justify-between items-start mb-2 pr-6">
                ${mainInfo}
            </div>
            <div class="border-t border-lightGray/70 pt-2 flex justify-between items-end mt-1">
                <div>
                    ${detailsInfo}
                    ${c.remark ? `<div class="text-xs text-slate-400 mt-1">📝 ${c.remark}</div>` : ''}
                </div>
                <div class="text-[11px] text-slate-400">📅 ${formatDateDisplay(c.date)}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

function getFilteredReportData() {
    let cashSum = 0;
    let goodsSum = 0;
    let expenseSum = 0;
    
    const filteredCont = appData.contributions.filter(c => {
        if (reportFilters.type === 'expense') return false;
        if (!c.date || typeof c.date !== 'string' || c.date.length < 7) return false;
        const year = c.date.substring(0, 4);
        const month = c.date.substring(5, 7);
        const yearMatch = reportFilters.year === 'all' || year === reportFilters.year;
        const monthMatch = reportFilters.month === 'all' || month === reportFilters.month;
        return yearMatch && monthMatch;
    });
    
    const filteredExp = appData.expenses.filter(e => {
        if (reportFilters.type === 'income') return false;
        if (!e.date || typeof e.date !== 'string' || e.date.length < 7) return false;
        const year = e.date.substring(0, 4);
        const month = e.date.substring(5, 7);
        const yearMatch = reportFilters.year === 'all' || year === reportFilters.year;
        const monthMatch = reportFilters.month === 'all' || month === reportFilters.month;
        return yearMatch && monthMatch;
    });
    
    filteredCont.forEach(c => {
        if (c.type === 'cash') {
            cashSum += parseFloat(c.amount) || 0;
        } else {
            goodsSum += parseFloat(c.total_value) || 0;
        }
    });
    
    filteredExp.forEach(e => {
        expenseSum += parseFloat(e.amount) || 0;
    });
    
    const collectionSum = cashSum + goodsSum;
    
    return {
        cash: cashSum,
        goods: goodsSum,
        collection: collectionSum,
        expense: expenseSum,
        balance: appData.dashboard ? parseFloat(appData.dashboard.current_balance) || 0 : 0,
        periodText: getFilterPeriodText()
    };
}

function getFilterPeriodText() {
    let typeTxt = '';
    if (reportFilters.type === 'income') typeTxt = ' [आय]';
    if (reportFilters.type === 'expense') typeTxt = ' [खर्च]';
    
    if (reportFilters.year === 'all' && reportFilters.month === 'all') {
        return 'सभी समय (All Time)' + typeTxt;
    }
    const monthNames = {
        '01': 'जनवरी', '02': 'फरवरी', '03': 'मार्च', '04': 'अप्रैल', '05': 'मई', '06': 'जून',
        '07': 'जुलाई', '08': 'अगस्त', '09': 'सितंबर', '10': 'अक्टूबर', '11': 'नवंबर', '12': 'दिसंबर'
    };
    const yText = reportFilters.year === 'all' ? 'सभी वर्ष' : reportFilters.year;
    const mText = reportFilters.month === 'all' ? 'सभी महीने' : monthNames[reportFilters.month];
    
    if (reportFilters.year === 'all') {
        return `${mText} (सभी वर्ष)` + typeTxt;
    }
    if (reportFilters.month === 'all') {
        return `${yText}` + typeTxt;
    }
    return `${mText} ${yText}` + typeTxt;
}

function renderFilteredReport() {
    const transactionsList = document.getElementById("transactionsList");
    if (!transactionsList) return;
    
    const fd = getFilteredReportData();
    
    const expenseCardVal = document.getElementById("reportTotalExpenseFiltered");
    if (expenseCardVal) {
        expenseCardVal.innerText = `₹ ${fd.expense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }
    
    const balanceCardVal = document.getElementById("reportCurrentBalance");
    if (balanceCardVal) {
        balanceCardVal.innerText = `₹ ${fd.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        
        // Color code balance text if negative/positive
        if (fd.balance < 0) {
            balanceCardVal.classList.add("text-red-300");
            balanceCardVal.classList.remove("text-white");
        } else {
            balanceCardVal.classList.add("text-white");
            balanceCardVal.classList.remove("text-red-300");
        }
    }
    
    const filterStatusText = document.getElementById("filterStatusText");
    if (filterStatusText) {
        filterStatusText.innerHTML = `अवधि: ${fd.periodText}`;
    }
    
    const filteredCont = appData.contributions.filter(c => {
        if (reportFilters.type === 'expense') return false;
        if (!c.date || typeof c.date !== 'string' || c.date.length < 7) return false;
        const year = c.date.substring(0, 4);
        const month = c.date.substring(5, 7);
        const yearMatch = reportFilters.year === 'all' || year === reportFilters.year;
        const monthMatch = reportFilters.month === 'all' || month === reportFilters.month;
        return yearMatch && monthMatch;
    });
    
    const filteredExp = appData.expenses.filter(e => {
        if (reportFilters.type === 'income') return false;
        if (!e.date || typeof e.date !== 'string' || e.date.length < 7) return false;
        const year = e.date.substring(0, 4);
        const month = e.date.substring(5, 7);
        const yearMatch = reportFilters.year === 'all' || year === reportFilters.year;
        const monthMatch = reportFilters.month === 'all' || month === reportFilters.month;
        return yearMatch && monthMatch;
    });
    
    let combined = [];
    filteredCont.forEach(c => {
        const itemDate = c.date ? new Date(c.date) : new Date();
        const tVal = isNaN(itemDate.getTime()) ? 0 : itemDate.getTime();
        combined.push({
            ...c,
            item_type: 'contribution',
            timestamp: tVal + parseInt(c.id || 0)
        });
    });
    filteredExp.forEach(e => {
        const itemDate = e.date ? new Date(e.date) : new Date();
        const tVal = isNaN(itemDate.getTime()) ? 0 : itemDate.getTime();
        combined.push({
            ...e,
            item_type: 'expense',
            timestamp: tVal + parseInt(e.id || 0)
        });
    });
    
    combined.sort((a, b) => b.timestamp - a.timestamp);
    
    const countText = document.getElementById("totalTransactionsCount");
    if (countText) {
        countText.innerText = `कुल प्रविष्टियां: ${combined.length}`;
    }
    
    transactionsList.innerHTML = '';
    
    if (combined.length === 0) {
        transactionsList.innerHTML = `<div class="text-center text-slate-400 py-8 text-xs">कोई लेनदेन नहीं मिला</div>`;
        return;
    }
    
    const canDelete = currentUser && (currentUser.is_admin === 1 || !appData.edit_locked);
    const canEdit = currentUser && (currentUser.is_admin === 1 || !appData.edit_locked);
    
    combined.forEach(item => {
        const card = document.createElement("div");
        card.className = "bg-white p-3.5 rounded-2xl shadow-sm border border-sandBeige/20 relative flex flex-col justify-between hover:shadow-md transition-shadow";
        
        let detailsHtml = "";
        let amountStr = "";
        let typeClass = "";
        let iconHtml = "";
        let titleHtml = "";
        
        if (item.item_type === 'contribution') {
            typeClass = item.type === 'cash' ? 'text-riverBlue' : 'text-natureGreen';
            iconHtml = item.type === 'cash' 
                ? `<span class="material-icons-outlined text-riverBlue bg-riverBlue/10 p-1.5 rounded-full text-lg">payments</span>`
                : `<span class="material-icons-outlined text-natureGreen bg-natureGreen/10 p-1.5 rounded-full text-lg">inventory_2</span>`;
            titleHtml = `<span class="font-medium text-slate-700">${item.name}</span> ने योगदान दिया`;
            
            if (item.type === 'cash') {
                amountStr = `+₹${item.amount.toLocaleString('en-IN')}`;
                detailsHtml = `<div class="text-slate-500 text-xs">💰 नकद दान: ${item.payment_mode === 'upi' ? 'UPI' : (item.payment_mode === 'bank' ? 'बैंक ट्रांसफर' : 'नकद')}</div>`;
            } else {
                amountStr = `+₹${item.total_value.toLocaleString('en-IN')}`;
                detailsHtml = `
                    <div class="text-slate-500 text-xs">🏗️ सामग्री: ${item.item_name}</div>
                    <div class="text-[11px] text-slate-400 mt-0.5">📦 मात्रा: ${item.quantity} | दर: ₹${item.rate}</div>
                `;
            }
        } else {
            typeClass = 'text-softRed';
            iconHtml = `<span class="material-icons-outlined text-softRed bg-softRed/10 p-1.5 rounded-full text-lg">payments</span>`;
            titleHtml = `💸 <span class="font-medium text-slate-700">${item.paid_to}</span> को भुगतान किया गया`;
            amountStr = `-₹${item.amount.toLocaleString('en-IN')}`;
            detailsHtml = `<div class="text-slate-500 text-xs">📝 ${item.description || 'खर्च विवरण उपलब्ध नहीं है'}</div>`;
        }
        
        let actionButtonsHtml = "";
        if (canEdit || canDelete) {
            actionButtonsHtml = `
                <div class="flex items-center gap-1.5">
                    ${canEdit ? `
                        <button onclick="openEditModal(${item.id}, '${item.item_type}')" class="text-riverBlue/70 hover:text-riverBlue p-1 rounded-full hover:bg-riverBlue/5 transition-colors" title="संशोधित करें">
                            <span class="material-icons-outlined text-base">edit</span>
                        </button>
                    ` : ''}
                    ${canDelete ? `
                        <button onclick="handleDelete(${item.id}, '${item.item_type}')" class="text-softRed/70 hover:text-softRed p-1 rounded-full hover:bg-softRed/5 transition-colors" title="हटाएं">
                            <span class="material-icons-outlined text-base">delete</span>
                        </button>
                    ` : ''}
                </div>
            `;
        }
        
        const billAttachment = (item.item_type === 'expense' && item.bill_image) ? `
            <button onclick="viewBillImage('${item.bill_image}')" class="mt-1 text-[11.5px] text-riverBlue flex items-center gap-1 hover:underline">
                <span class="material-icons-outlined text-xs">receipt_long</span>
                रसीद देखें (View Bill)
            </button>
        ` : '';
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2 pr-6">
                <div class="flex items-center gap-2">
                    <div class="flex-shrink-0">${iconHtml}</div>
                    <div class="min-w-0">
                        <div class="text-[13.5px] text-slate-600 truncate">${titleHtml}</div>
                        <div class="text-[11px] text-slate-400 mt-0.5">📅 ${formatDateDisplay(item.date)}</div>
                    </div>
                </div>
                <span class="text-[14.5px] font-semibold ${typeClass} text-right block">${amountStr}</span>
            </div>
            <div class="border-t border-lightGray/70 pt-2 flex justify-between items-end mt-1">
                <div>
                    ${detailsHtml}
                    ${item.remark ? `<div class="text-[11px] text-slate-400 mt-1">📝 ${item.remark}</div>` : ''}
                    ${billAttachment}
                </div>
                ${actionButtonsHtml}
            </div>
        `;
        transactionsList.appendChild(card);
    });
}

function openEditModal(id, type) {
    if (!currentUser) {
        alert("संशोधन करने के लिए कृपया पहले लॉगिन करें।");
        return;
    }
    
    if (type === 'contribution') {
        const item = appData.contributions.find(c => c.id === id);
        if (!item) return;
        
        document.getElementById("editContId").value = item.id;
        document.getElementById("editContName").value = item.name;
        document.getElementById("editContMobile").value = item.mobile || "";
        document.getElementById("editContRemark").value = item.remark || "";
        document.getElementById("editContDate").value = formatDateDisplay(item.date);
        
        const typeBtn = document.getElementById("dropdownEditTypeBtn");
        const typeVal = document.getElementById("dropdownEditTypeValue");
        if (typeBtn && typeVal) {
            typeBtn.setAttribute("data-selected-value", item.type);
            if (item.type === 'cash') {
                typeVal.innerHTML = `<span class="material-icons-outlined text-riverBlue text-sm">payments</span> 💰 नकद (Cash)`;
                document.getElementById("editCashFields").classList.remove("hidden");
                document.getElementById("editGoodsFields").classList.add("hidden");
            } else {
                typeVal.innerHTML = `<span class="material-icons-outlined text-natureGreen text-sm">inventory_2</span> 🏗️ सामग्री (Goods)`;
                document.getElementById("editCashFields").classList.add("hidden");
                document.getElementById("editGoodsFields").classList.remove("hidden");
            }
        }
        
        document.getElementById("editCashAmount").value = item.amount || "";
        const modeBtn = document.getElementById("dropdownEditModeBtn");
        const modeVal = document.getElementById("dropdownEditModeValue");
        if (modeBtn && modeVal) {
            const mode = item.payment_mode || "cash";
            modeBtn.setAttribute("data-selected-value", mode);
            let modeHtml = "💵 नकद (Cash)";
            if (mode === "upi") modeHtml = "📱 UPI (PhonePe / GPay)";
            if (mode === "bank") modeHtml = "🏦 बैंक ट्रांसफर";
            modeVal.innerHTML = modeHtml;
        }
        
        document.getElementById("editGoodsItemName").value = item.item_name || "";
        document.getElementById("editGoodsQty").value = item.quantity || "";
        document.getElementById("editGoodsRate").value = item.rate || "";
        document.getElementById("editGoodsAutoTotal").innerText = `₹ ${(item.total_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        
        document.getElementById("contributionModal").classList.remove("hidden");
    } else if (type === 'expense') {
        const item = appData.expenses.find(e => e.id === id);
        if (!item) return;
        
        document.getElementById("expId").value = item.id;
        document.getElementById("expAmount").value = item.amount;
        document.getElementById("expPaidTo").value = item.paid_to;
        document.getElementById("expDate").value = formatDateDisplay(item.date);
        document.getElementById("expDesc").value = item.description || "";
        
        const billFileNameLabel = document.getElementById("billFileName");
        const clearBillBtn = document.getElementById("clearBillBtn");
        if (item.bill_image) {
            if (billFileNameLabel) billFileNameLabel.innerText = "मौजूदा रसीद";
            if (clearBillBtn) clearBillBtn.classList.remove("hidden");
        } else {
            if (billFileNameLabel) billFileNameLabel.innerText = "फोटो अपलोड करें";
            if (clearBillBtn) clearBillBtn.classList.add("hidden");
        }
        
        base64BillImage = ""; 
        document.getElementById("expenseForm").setAttribute("data-keep-image", "true");
        
        document.getElementById("expenseModalTitle").innerText = "💸 खर्च संशोधित करें (Edit Expense)";
        document.querySelector("#expenseForm button[type='submit']").innerText = "अपडेट सुरक्षित करें";
        
        document.getElementById("expenseModal").classList.remove("hidden");
    }
}

function renderMembersList() {
    const settingsContainer = document.getElementById("membersListContainer");
    const tabContainer = document.getElementById("tabMembersListContainer");

    const countEl = document.getElementById("membersCountText");
    const tabCountEl = document.getElementById("tabMembersCountText");

    const totalCount = appData.members.length;
    if (countEl) countEl.innerText = `कुल सदस्य: ${totalCount}`;
    if (tabCountEl) tabCountEl.innerText = `कुल सदस्य: ${totalCount}`;

    function populateList(container) {
        if (!container) return;
        container.innerHTML = '';

        if (totalCount === 0) {
            container.innerHTML = `<div class="text-center text-slate-400 py-8 text-xs">कोई सदस्य नहीं मिला</div>`;
            return;
        }

        appData.members.forEach(m => {
            const card = document.createElement("div");
            card.className = "bg-white p-4 rounded-2xl shadow-sm border border-sandBeige/20 hover:shadow-md transition-shadow cursor-pointer flex flex-col";
            card.addEventListener("click", () => showMemberDetail(m));

            const isAdminBadge = m.is_admin === 1 ? `
                <span class="text-[10px] bg-riverBlue/10 text-riverBlue px-1.5 py-0.5 rounded font-medium">एडमिन</span>
            ` : '';

            const callBtn = `
                <a href="tel:${m.mobile}" onclick="event.stopPropagation();" 
                    class="flex-1 bg-natureGreen/10 hover:bg-natureGreen/25 text-natureGreen border border-natureGreen/25 text-xs font-semibold py-2 rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors">
                    <span class="material-icons-outlined text-base">call</span> कॉल करें
                </a>
            `;

            const contributeBtn = `
                <button onclick="event.stopPropagation(); openAddContributionModal('${m.name}', '${m.mobile}')" 
                    class="flex-1 bg-riverBlue hover:bg-riverBlue/95 text-white text-xs font-semibold py-2 rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors shadow-sm">
                    <span class="material-icons-outlined text-base">add_circle</span> योगदान
                </button>
            `;

            card.innerHTML = `
                <!-- Top Row: Profile & Total Contribution -->
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center gap-3">
                        <div class="bg-riverBlue/10 text-riverBlue w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm">
                            ${m.name.charAt(0)}
                        </div>
                        <div>
                            <div class="text-[14.5px] font-semibold text-slate-700 flex items-center gap-1.5">
                                ${m.name}
                                ${isAdminBadge}
                            </div>
                            <div class="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                <span class="material-icons-outlined text-xs">phone</span> ${m.mobile}
                            </div>
                        </div>
                    </div>
                    
                    <div class="text-right">
                        <div class="text-[15.5px] font-bold text-riverBlue">₹${m.overall_total.toLocaleString('en-IN')}</div>
                        <div class="text-[9px] text-slate-400 font-medium tracking-wide uppercase">कुल दान</div>
                    </div>
                </div>
                
                <!-- Divider -->
                <div class="border-t border-slate-100 my-2"></div>
                
                <!-- Bottom Row: Action Buttons -->
                <div class="flex items-center gap-3 mt-2">
                    ${contributeBtn}
                    ${callBtn}
                </div>
            `;
            container.appendChild(card);
        });
    }

    populateList(settingsContainer);
    populateList(tabContainer);

    // Re-apply search filter if query exists
    const searchInput = document.getElementById("universalSearchInput");
    if (searchInput && searchInput.value.trim() !== "") {
        const query = searchInput.value.trim().toLowerCase();
        filterListCards("tabMembersListContainer", query);
    }
}

// ================= MEMBER DETAIL MODAL =================
function showMemberDetail(member) {
    const modal = document.getElementById("memberDetailModal");
    if (!modal) return;
    const nameEl = document.getElementById("mDetName");
    const cashEl = document.getElementById("mDetCash");
    const goodsEl = document.getElementById("mDetGoods");
    const overallEl = document.getElementById("mDetOverall");
    const historyList = document.getElementById("mDetHistoryList");

    if (nameEl) nameEl.innerHTML = `👤 ${member.name} (${member.is_admin ? 'एडमिन' : 'सदस्य'})`;
    if (cashEl) cashEl.innerText = `₹ ${member.cash_total.toLocaleString('en-IN')}`;
    if (goodsEl) goodsEl.innerText = `₹ ${member.goods_total.toLocaleString('en-IN')}`;
    if (overallEl) overallEl.innerText = `₹ ${member.overall_total.toLocaleString('en-IN')}`;

    // Render Admin Controls toggle inside the modal
    const adminControlsEl = document.getElementById("mDetAdminControls");
    if (adminControlsEl) {
        if (currentUser && currentUser.is_admin === 1) {
            adminControlsEl.classList.remove("hidden");
            const disabledAttr = member.id === currentUser.id ? 'disabled opacity-50' : '';
            const checkedAttr = member.status === 1 ? 'checked' : '';
            adminControlsEl.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <span class="text-xs font-semibold text-slate-700 block">लॉगिन अनुमति (Login Allowed)</span>
                        <span class="text-[10px] text-slate-400">इस सदस्य के लिए लॉगिन सुविधा चालू या बंद करें।</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" ${checkedAttr} ${disabledAttr} 
                            onchange="handleMemberStatusToggle(${member.id}, this.checked)" class="sr-only peer">
                        <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-riverBlue"></div>
                    </label>
                </div>
            `;
        } else {
            adminControlsEl.classList.add("hidden");
            adminControlsEl.innerHTML = "";
        }
    }

    if (historyList) {
        historyList.innerHTML = '';
        
        // Filter contributions by this member mobile
        const mContributions = appData.contributions.filter(c => c.mobile === member.mobile);
        
        if (mContributions.length === 0) {
            historyList.innerHTML = `<div class="text-center text-slate-400 py-4 text-xs">कोई योगदान इतिहास नहीं मिला</div>`;
        } else {
            mContributions.forEach(c => {
                const row = document.createElement("div");
                row.className = "flex justify-between items-center text-sm p-2 bg-lightGray rounded-lg";
                
                let desc = c.type === 'cash' ? `💵 नकद दान` : `🏗️ सामग्री: ${c.item_name}`;
                let val = c.type === 'cash' ? `+₹${c.amount.toLocaleString('en-IN')}` : `+₹${c.total_value.toLocaleString('en-IN')}`;
                let valColor = c.type === 'cash' ? 'text-riverBlue' : 'text-natureGreen';

                row.innerHTML = `
                    <div>
                        <span class="font-medium text-slate-700 block">${desc}</span>
                        <span class="text-[11px] text-slate-400">📅 ${formatDateDisplay(c.date)} ${c.remark ? '| ' + c.remark : ''}</span>
                    </div>
                    <span class="font-semibold ${valColor}">${val}</span>
                `;
                historyList.appendChild(row);
            });
        }
    }

    modal.classList.remove("hidden");
    
    // Close modal listener
    const closeBtn = document.getElementById("closeMemberDetailModal");
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.classList.add("hidden");
        };
    }
}

// ================= ADD CONTRIBUTION MODAL CONTROLS =================
function initAddContributionModal() {
    const modal = document.getElementById("addContributionModal");
    const closeBtn = document.getElementById("closeAddContributionModal");
    
    if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => {
            modal.classList.add("hidden");
        });
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.classList.add("hidden");
            }
        });
    }

    // Calculations for the new modal (Goods Auto Total)
    const qtyInput = document.getElementById("addGoodsQty");
    const rateInput = document.getElementById("addGoodsRate");
    const totalDiv = document.getElementById("addGoodsAutoTotal");

    if (qtyInput && rateInput && totalDiv) {
        function calculateTotal() {
            const qty = parseFloat(qtyInput.value) || 0;
            const rate = parseFloat(rateInput.value) || 0;
            const total = qty * rate;
            totalDiv.innerText = `₹ ${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        qtyInput.addEventListener("input", calculateTotal);
        rateInput.addEventListener("input", calculateTotal);
    }
}

function openAddContributionModal(name, mobile) {
    if (!currentUser) {
        alert("योगदान जोड़ने के लिए कृपया पहले लॉगिन करें।");
        return;
    }
    
    // Reset form
    const addContForm = document.getElementById("addContributionForm");
    if (addContForm) addContForm.reset();

    // Show readonly name input and hide member selection dropdown container
    const nameCont = document.getElementById("addContNameContainer");
    const selectCont = document.getElementById("addContMemberSelectContainer");
    if (nameCont) nameCont.classList.remove("hidden");
    if (selectCont) selectCont.classList.add("hidden");
    
    // Populate readonly fields
    const nameEl = document.getElementById("addContName");
    const mobileEl = document.getElementById("addContMobile");
    if (nameEl) nameEl.value = name;
    if (mobileEl) mobileEl.value = mobile;
    
    // Reset dropdown to Cash
    const typeBtn = document.getElementById("dropdownAddTypeBtn");
    const typeValSpan = document.getElementById("dropdownAddTypeValue");
    if (typeValSpan) typeValSpan.innerHTML = `<span class="material-icons-outlined text-riverBlue text-sm">payments</span> 💰 नकद (Cash)`;
    if (typeBtn) typeBtn.setAttribute("data-selected-value", "cash");
    
    const cashFields = document.getElementById("addCashFields");
    const goodsFields = document.getElementById("addGoodsFields");
    const goodsAutoTotal = document.getElementById("addGoodsAutoTotal");
    if (cashFields) cashFields.classList.remove("hidden");
    if (goodsFields) goodsFields.classList.add("hidden");
    if (goodsAutoTotal) goodsAutoTotal.innerText = "₹ 0.00";
    
    // Set date to today
    const dateEl = document.getElementById("addContDate");
    if (dateEl) dateEl.value = getFormattedDate(new Date());
    
    // Open modal
    const modal = document.getElementById("addContributionModal");
    if (modal) modal.classList.remove("hidden");
}

function openGeneralAddContributionModal() {
    if (!currentUser) {
        alert("योगदान जोड़ने के लिए कृपया पहले लॉगिन करें।");
        return;
    }

    // Reset form
    const addContForm = document.getElementById("addContributionForm");
    if (addContForm) addContForm.reset();

    // Show member selection dropdown container and hide readonly name input
    const nameCont = document.getElementById("addContNameContainer");
    const selectCont = document.getElementById("addContMemberSelectContainer");
    if (nameCont) nameCont.classList.add("hidden");
    if (selectCont) selectCont.classList.remove("hidden");

    // Populate dropdown list with members
    const memberListDiv = document.getElementById("dropdownAddMemberList");
    const memberValSpan = document.getElementById("dropdownAddMemberValue");
    const memberBtn = document.getElementById("dropdownAddMemberBtn");

    if (memberValSpan) memberValSpan.innerHTML = "👥 सदस्य चुनें";
    if (memberBtn) {
        memberBtn.removeAttribute("data-selected-value");
    }

    if (memberListDiv) {
        memberListDiv.innerHTML = '';
        appData.members.forEach(m => {
            const item = document.createElement("div");
            item.className = "px-4 py-2.5 text-sm hover:bg-sandBeige/20 cursor-pointer flex justify-between items-center";
            item.innerHTML = `<span>👤 ${m.name}</span><span class="text-xs text-slate-400">📞 ${m.mobile}</span>`;
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                if (memberValSpan) memberValSpan.innerHTML = `👤 ${m.name}`;
                if (memberBtn) {
                    memberBtn.setAttribute("data-selected-value", m.mobile);
                }
                
                // Set hidden name and mobile inputs so form submit logic stays unchanged!
                const nameEl = document.getElementById("addContName");
                const mobileEl = document.getElementById("addContMobile");
                if (nameEl) nameEl.value = m.name;
                if (mobileEl) mobileEl.value = m.mobile;

                memberListDiv.classList.add("hidden");
            });
            memberListDiv.appendChild(item);
        });
    }

    // Reset other fields to Cash and Today
    const typeBtn = document.getElementById("dropdownAddTypeBtn");
    const typeValSpan = document.getElementById("dropdownAddTypeValue");
    if (typeValSpan) typeValSpan.innerHTML = `<span class="material-icons-outlined text-riverBlue text-sm">payments</span> 💰 नकद (Cash)`;
    if (typeBtn) typeBtn.setAttribute("data-selected-value", "cash");
    
    const cashFields = document.getElementById("addCashFields");
    const goodsFields = document.getElementById("addGoodsFields");
    const goodsAutoTotal = document.getElementById("addGoodsAutoTotal");
    if (cashFields) cashFields.classList.remove("hidden");
    if (goodsFields) goodsFields.classList.add("hidden");
    if (goodsAutoTotal) goodsAutoTotal.innerText = "₹ 0.00";
    
    const dateEl = document.getElementById("addContDate");
    if (dateEl) dateEl.value = getFormattedDate(new Date());

    const modal = document.getElementById("addContributionModal");
    if (modal) modal.classList.remove("hidden");
}

function toggleTabAddMemberForm() {
    const form = document.getElementById("addMemberFormTab");
    const icon = document.getElementById("tabAddMemberFormIcon");
    if (form && icon) {
        const isHidden = form.classList.contains("hidden");
        if (isHidden) {
            form.classList.remove("hidden");
            icon.innerText = "expand_less";
        } else {
            form.classList.add("hidden");
            icon.innerText = "expand_more";
        }
    }
}

// Bind to window scope for onclick usage
window.openAddContributionModal = openAddContributionModal;
window.openGeneralAddContributionModal = openGeneralAddContributionModal;
window.toggleSettingsAddMemberForm = toggleSettingsAddMemberForm;

// ================= VIEW BILL IMAGE (LIGHTBOX) =================
function viewBillImage(imgSrc) {
    const modal = document.getElementById("billImageModal");
    const modalImg = document.getElementById("billModalImg");
    if (modal && modalImg) {
        modalImg.src = imgSrc;
        modal.classList.remove("hidden");
    }
}

// ================= ACTIONS =================
function handleDelete(id, type) {
    if (!confirm("क्या आप वाकई इस प्रविष्टि को हटाना चाहते हैं?")) {
        return;
    }

    if (!currentUser) {
        alert("कृपया प्रविष्टि हटाने के लिए लॉगिन करें।");
        return;
    }

    fetch('api.php?action=delete_entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: id,
            type: type,
            user_mobile: currentUser.mobile
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(data.message);
            fetchLiveData(); // Refresh
        } else {
            alert(data.error || "हटाने में त्रुटि हुई।");
        }
    })
    .catch(err => {
        console.error(err);
        alert("सर्वर से जुड़ने में समस्या हुई।");
    });
}

function handleMemberStatusToggle(memberId, isEnabled) {
    if (!currentUser) return;
    
    fetch('api.php?action=toggle_member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            member_id: memberId,
            status: isEnabled ? 1 : 0,
            user_mobile: currentUser.mobile
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            fetchLiveData();
        } else {
            alert(data.error || "स्टेटस बदलने में विफल।");
            fetchLiveData(); // Rollback UI state
        }
    })
    .catch(err => {
        console.error(err);
        fetchLiveData(); // Rollback UI state
    });
}

// ================= ADMIN TOGGLES =================
function initAdminToggle() {
    const adminLockEditToggle = document.getElementById("adminLockEditToggle");
    if (adminLockEditToggle) {
        adminLockEditToggle.addEventListener("change", function() {
            if (!currentUser) return;
            
            const isLocked = this.checked ? 1 : 0;
            
            fetch('api.php?action=toggle_edit_mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    edit_locked: isLocked,
                    user_mobile: currentUser.mobile
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    fetchLiveData();
                    alert(`सिस्टम एडिट मोड सफलता पूर्वक ${isLocked ? "लॉक" : "अनलॉक"} किया गया।`);
                } else {
                    alert(data.error || "संपादन मोड बदलने में विफल।");
                    fetchLiveData(); // Rollback UI state
                }
            })
            .catch(err => {
                console.error(err);
                fetchLiveData(); // Rollback UI state
            });
        });
    }
}

// ================= FORM SUBMISSIONS =================
function initFormSubmits() {
    // 1. Contribution Form
    const contForm = document.getElementById("contributionForm");
    if (contForm) {
        contForm.addEventListener("submit", (e) => {
            e.preventDefault();

            if (!currentUser) {
                alert("योगदान जोड़ने के लिए कृपया पहले लॉगिन करें।");
                return;
            }

            const nameEl = document.getElementById("contName");
            const mobileEl = document.getElementById("contMobile");
            const dateEl = document.getElementById("contDate");
            const remarkEl = document.getElementById("contRemark");
            const typeBtn = document.getElementById("dropdownTypeBtn");
            const cashAmountEl = document.getElementById("cashAmount");
            const dropdownModeBtn = document.getElementById("dropdownModeBtn");
            const goodsItemNameEl = document.getElementById("goodsItemName");
            const goodsQtyEl = document.getElementById("goodsQty");
            const goodsRateEl = document.getElementById("goodsRate");

            if (!nameEl || !dateEl) return;

            const name = nameEl.value.trim();
            const mobile = mobileEl ? mobileEl.value.trim() : "";
            
            // Date parsing: Format from DD-MM-YYYY to YYYY-MM-DD for Database
            const rawDate = dateEl.value;
            const dateParts = rawDate.split('-');
            const date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            
            const remark = remarkEl ? remarkEl.value.trim() : "";
            const type = typeBtn ? (typeBtn.getAttribute("data-selected-value") || 'cash') : 'cash';
            
            let payload = {
                user_mobile: currentUser.mobile,
                name,
                mobile,
                type,
                date,
                remark
            };

            if (type === 'cash') {
                payload.amount = cashAmountEl ? (parseFloat(cashAmountEl.value) || 0) : 0;
                payload.payment_mode = dropdownModeBtn ? (dropdownModeBtn.getAttribute("data-selected-value") || 'cash') : 'cash';
            } else {
                payload.item_name = goodsItemNameEl ? goodsItemNameEl.value.trim() : "";
                payload.quantity = goodsQtyEl ? (parseFloat(goodsQtyEl.value) || 0) : 0;
                payload.rate = goodsRateEl ? (parseFloat(goodsRateEl.value) || 0) : 0;
            }

            fetch('api.php?action=add_contribution', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert(data.message);
                    contForm.reset();
                    // Reset custom dropdown values
                    const typeValSpan = document.getElementById("dropdownTypeValue");
                    if (typeValSpan) typeValSpan.innerHTML = `<span class="material-icons-outlined text-riverBlue text-sm">payments</span> 💰 नकद (Cash)`;
                    if (typeBtn) typeBtn.setAttribute("data-selected-value", "cash");
                    
                    const cashFields = document.getElementById("cashFields");
                    const goodsFields = document.getElementById("goodsFields");
                    const goodsAutoTotal = document.getElementById("goodsAutoTotal");
                    if (cashFields) cashFields.classList.remove("hidden");
                    if (goodsFields) goodsFields.classList.add("hidden");
                    if (goodsAutoTotal) goodsAutoTotal.innerText = "₹ 0.00";
                    
                    // Reset calendar input to today
                    dateEl.value = getFormattedDate(new Date());

                    fetchLiveData(); // Refresh data
                    // Navigate to Dashboard
                    const dashBtn = document.querySelector('[data-target="page-dashboard"]');
                    if (dashBtn) dashBtn.click();
                } else {
                    alert(data.error || "योगदान जोड़ने में विफल!");
                }
            })
            .catch(err => {
                console.error(err);
                alert("योगदान जोड़ने में त्रुटि आई।");
            });
        });
    }

    // Handle Bill file upload label feedback
    const billFileInput = document.getElementById("expBillFile");
    const billFileNameLabel = document.getElementById("billFileName");
    const clearBillBtn = document.getElementById("clearBillBtn");

    if (billFileInput) {
        billFileInput.addEventListener("change", function() {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                if (billFileNameLabel) billFileNameLabel.innerText = file.name.substring(0, 15) + '...';
                if (clearBillBtn) clearBillBtn.classList.remove("hidden");

                const reader = new FileReader();
                reader.onload = function(e) {
                    base64BillImage = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (clearBillBtn) {
        clearBillBtn.addEventListener("click", () => {
            if (billFileInput) billFileInput.value = "";
            if (billFileNameLabel) billFileNameLabel.innerText = "फोटो अपलोड करें";
            clearBillBtn.classList.add("hidden");
            base64BillImage = "";
        });
    }

    // 2. Expense Form
    const expForm = document.getElementById("expenseForm");
    if (expForm) {
        expForm.addEventListener("submit", (e) => {
            e.preventDefault();

            if (!currentUser) {
                alert("खर्च जोड़ने के लिए कृपया पहले लॉगिन करें।");
                return;
            }

            const amountEl = document.getElementById("expAmount");
            const paidToEl = document.getElementById("expPaidTo");
            const dateEl = document.getElementById("expDate");
            const descEl = document.getElementById("expDesc");

            if (!amountEl || !paidToEl || !dateEl) return;

            const amount = parseFloat(amountEl.value) || 0;
            const paid_to = paidToEl.value.trim();
            
            // Date parsing: Format from DD-MM-YYYY to YYYY-MM-DD
            const rawDate = dateEl.value;
            const dateParts = rawDate.split('-');
            const date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            
            const description = descEl ? descEl.value.trim() : "";

            const id = document.getElementById("expId").value;
            const keepImage = expForm.getAttribute("data-keep-image") === "true";
            
            let url = 'api.php?action=add_expense';
            let bodyPayload = {
                user_mobile: currentUser.mobile,
                amount,
                paid_to,
                date,
                description,
                bill_image: base64BillImage
            };
            
            if (id) {
                url = 'api.php?action=update_expense';
                bodyPayload.id = parseInt(id);
                bodyPayload.keep_existing_image = keepImage;
            }

            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert(data.message);
                    expForm.reset();
                    base64BillImage = "";
                    if (billFileNameLabel) billFileNameLabel.innerText = "फोटो अपलोड करें";
                    if (clearBillBtn) clearBillBtn.classList.add("hidden");
                    
                    // Close Modal
                    const modal = document.getElementById("expenseModal");
                    if (modal) modal.classList.add("hidden");
                    
                    // Reset calendar input to today
                    dateEl.value = getFormattedDate(new Date());

                    fetchLiveData(); // Refresh
                    
                    // Navigate to Reports Page
                    const reportsBtn = document.querySelector('[data-target="page-reports"]');
                    if (reportsBtn) reportsBtn.click();
                } else {
                    alert(data.error || "खर्च सुरक्षित करने में विफल!");
                }
            })
            .catch(err => {
                console.error(err);
                alert("खर्च सुरक्षित करने में त्रुटि आई।");
            });
        });
    }

    // 3. Add Member Form Settings
    const addMembFormSettings = document.getElementById("addMemberFormSettings");
    if (addMembFormSettings) {
        addMembFormSettings.addEventListener("submit", (e) => {
            e.preventDefault();

            if (!currentUser) {
                alert("सदस्य जोड़ने के लिए कृपया पहले लॉगिन करें।");
                return;
            }

            const nameEl = document.getElementById("settingsMemberName");
            const mobileEl = document.getElementById("settingsMemberMobile");

            if (!nameEl || !mobileEl) return;

            const name = nameEl.value.trim();
            const mobile = mobileEl.value.trim();

            fetch('api.php?action=add_member', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_mobile: currentUser.mobile,
                    name,
                    mobile
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert(data.message);
                    addMembFormSettings.reset();
                    fetchLiveData(); // Refresh
                    
                    // Collapse the form
                    const form = document.getElementById("addMemberFormSettings");
                    const icon = document.getElementById("settingsAddMemberFormIcon");
                    if (form) form.classList.add("hidden");
                    if (icon) icon.innerText = "expand_more";
                } else {
                    alert(data.error || "सदस्य जोड़ने में विफल!");
                }
            })
            .catch(err => {
                console.error(err);
                alert("सदस्य जोड़ने में त्रुटि आई।");
            });
        });
    }

    // 4. Edit Contribution Form Submit
    const editContForm = document.getElementById("editContributionForm");
    if (editContForm) {
        editContForm.addEventListener("submit", (e) => {
            e.preventDefault();

            if (!currentUser) {
                alert("योगदान संशोधित करने के लिए कृपया पहले लॉगिन करें।");
                return;
            }

            const idEl = document.getElementById("editContId");
            const nameEl = document.getElementById("editContName");
            const mobileEl = document.getElementById("editContMobile");
            const dateEl = document.getElementById("editContDate");
            const remarkEl = document.getElementById("editContRemark");
            const typeBtn = document.getElementById("dropdownEditTypeBtn");
            const cashAmountEl = document.getElementById("editCashAmount");
            const dropdownModeBtn = document.getElementById("dropdownEditModeBtn");
            const goodsItemNameEl = document.getElementById("editGoodsItemName");
            const goodsQtyEl = document.getElementById("editGoodsQty");
            const goodsRateEl = document.getElementById("editGoodsRate");

            if (!idEl || !nameEl || !dateEl) return;

            const id = parseInt(idEl.value);
            const name = nameEl.value.trim();
            const mobile = mobileEl ? mobileEl.value.trim() : "";
            
            // Date parsing
            const rawDate = dateEl.value;
            const dateParts = rawDate.split('-');
            const date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            
            const remark = remarkEl ? remarkEl.value.trim() : "";
            const type = typeBtn ? (typeBtn.getAttribute("data-selected-value") || 'cash') : 'cash';
            
            let payload = {
                user_mobile: currentUser.mobile,
                id,
                name,
                mobile,
                type,
                date,
                remark
            };

            if (type === 'cash') {
                payload.amount = cashAmountEl ? (parseFloat(cashAmountEl.value) || 0) : 0;
                payload.payment_mode = dropdownModeBtn ? (dropdownModeBtn.getAttribute("data-selected-value") || 'cash') : 'cash';
            } else {
                payload.item_name = goodsItemNameEl ? goodsItemNameEl.value.trim() : "";
                payload.quantity = goodsQtyEl ? (parseFloat(goodsQtyEl.value) || 0) : 0;
                payload.rate = goodsRateEl ? (parseFloat(goodsRateEl.value) || 0) : 0;
            }

            fetch('api.php?action=update_contribution', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert(data.message);
                    editContForm.reset();
                    const modal = document.getElementById("contributionModal");
                    if (modal) modal.classList.add("hidden");
                    fetchLiveData(); // Refresh
                } else {
                    alert(data.error || "योगदान संशोधित करने में विफल!");
                }
            })
            .catch(err => {
                console.error(err);
                alert("योगदान संशोधित करने में त्रुटि आई।");
            });
        });
    }

    // Modal close hooks for contributionModal
    const closeContBtn = document.getElementById("closeContributionModal");
    const contModal = document.getElementById("contributionModal");
    if (closeContBtn && contModal) {
        closeContBtn.addEventListener("click", () => {
            contModal.classList.add("hidden");
        });
        contModal.addEventListener("click", (e) => {
            if (e.target === contModal) {
                contModal.classList.add("hidden");
            }
        });
    }

    // 5. Add Contribution Form Submit (Modal)
    const addContForm = document.getElementById("addContributionForm");
    if (addContForm) {
        addContForm.addEventListener("submit", (e) => {
            e.preventDefault();

            if (!currentUser) {
                alert("योगदान जोड़ने के लिए कृपया पहले लॉगिन करें।");
                return;
            }

            const nameEl = document.getElementById("addContName");
            const mobileEl = document.getElementById("addContMobile");
            const dateEl = document.getElementById("addContDate");
            const remarkEl = document.getElementById("addContRemark");
            const typeBtn = document.getElementById("dropdownAddTypeBtn");
            const cashAmountEl = document.getElementById("addCashAmount");
            const dropdownModeBtn = document.getElementById("dropdownAddModeBtn");
            const goodsItemNameEl = document.getElementById("addGoodsItemName");
            const goodsQtyEl = document.getElementById("addGoodsQty");
            const goodsRateEl = document.getElementById("addGoodsRate");

            if (!nameEl || !dateEl) return;

            const name = nameEl.value.trim();
            const mobile = mobileEl ? mobileEl.value.trim() : "";
            
            // Date parsing: Format from DD-MM-YYYY to YYYY-MM-DD for Database
            const rawDate = dateEl.value;
            const dateParts = rawDate.split('-');
            const date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            
            const remark = remarkEl ? remarkEl.value.trim() : "";
            const type = typeBtn ? (typeBtn.getAttribute("data-selected-value") || 'cash') : 'cash';
            
            let payload = {
                user_mobile: currentUser.mobile,
                name,
                mobile,
                type,
                date,
                remark
            };

            if (type === 'cash') {
                payload.amount = cashAmountEl ? (parseFloat(cashAmountEl.value) || 0) : 0;
                payload.payment_mode = dropdownModeBtn ? (dropdownModeBtn.getAttribute("data-selected-value") || 'cash') : 'cash';
            } else {
                payload.item_name = goodsItemNameEl ? goodsItemNameEl.value.trim() : "";
                payload.quantity = goodsQtyEl ? (parseFloat(goodsQtyEl.value) || 0) : 0;
                payload.rate = goodsRateEl ? (parseFloat(goodsRateEl.value) || 0) : 0;
            }

            fetch('api.php?action=add_contribution', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert(data.message);
                    addContForm.reset();
                    
                    const modal = document.getElementById("addContributionModal");
                    if (modal) modal.classList.add("hidden");

                    fetchLiveData(); // Refresh data
                } else {
                    alert(data.error || "योगदान जोड़ने में विफल!");
                }
            })
            .catch(err => {
                console.error(err);
                alert("योगदान जोड़ने में त्रुटि आई।");
            });
        });
    }


}
      function initReportFilters() {
    // 1. Year Filter Dropdown
    setupCustomDropdown(
        "dropdownFilterYearBtn",
        "dropdownFilterYearList",
        "dropdownFilterYearValue",
        (val) => {
            reportFilters.year = val;
            renderFilteredReport();
        }
    );

    // 2. Month Filter Dropdown
    setupCustomDropdown(
        "dropdownFilterMonthBtn",
        "dropdownFilterMonthList",
        "dropdownFilterMonthValue",
        (val) => {
            reportFilters.month = val;
            renderFilteredReport();
        }
    );

    // 3. Type Filter Dropdown
    setupCustomDropdown(
        "dropdownFilterTypeBtn",
        "dropdownFilterTypeList",
        "dropdownFilterTypeValue",
        (val) => {
            reportFilters.type = val;
            renderFilteredReport();
        }
    );
}

function initExportActions() {
    const pdfBtn = document.getElementById("pdfExportBtn");
    const waBtn = document.getElementById("whatsappShareBtn");

    // WhatsApp Share Format Handler
    if (waBtn) {
        waBtn.addEventListener("click", () => {
            const fd = getFilteredReportData();
            const formattedText = `🌿 *PRAJAPATI EKTA GROUP*
🌊 *Ghaat Construction Report*
📅 *अवधि:* ${fd.periodText}

💰 *नकद योगदान:* ₹${fd.cash.toLocaleString('en-IN')}
🏗️ *सामग्री मूल्य:* ₹${fd.goods.toLocaleString('en-IN')}

📦 *कुल संग्रह (अवधि):* ₹${fd.collection.toLocaleString('en-IN')}
💸 *कुल खर्च (अवधि):* ₹${fd.expense.toLocaleString('en-IN')}

💰 *वर्तमान कुल शेष (Overall Balance):* ₹${fd.balance.toLocaleString('en-IN')}

🙏 धन्यवाद (सेवा ही संकल्प है)`;

            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(formattedText)}`, '_blank');
        });
    }

    // PDF Export Handler
    if (pdfBtn) {
        pdfBtn.addEventListener("click", () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const fd = getFilteredReportData();

            // Custom PDF Design (A4 Size: 210mm x 297mm)
            // Draw Border
            doc.setDrawColor(30, 90, 168); // River Blue color
            doc.setLineWidth(0.5);
            doc.rect(5, 5, 200, 287);

            // Header Title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.setTextColor(30, 90, 168); // River Blue
            doc.text("PRAJAPATI EKTA GROUP", 105, 20, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(46, 125, 50); // Nature Green
            doc.text("Ghaat Construction Financial Summary Report", 105, 27, { align: "center" });

            // Divider
            doc.setDrawColor(245, 230, 200); // sandBeige divider
            doc.setLineWidth(1);
            doc.line(15, 33, 195, 33);

            // Metadata
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            const today = new Date();
            doc.text(`Generated Date: ${getFormattedDate(today)}`, 15, 42);
            doc.text(`Period: ${fd.periodText}`, 195, 42, { align: "right" });

            // Table Block
            let currentY = 55;
            doc.setFillColor(245, 247, 250); // Light Gray Background
            doc.rect(15, currentY, 180, 80, "F");

            // Table Borders
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.2);
            doc.rect(15, currentY, 180, 80);

            // Rows
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(51, 65, 85);
            
            // Row 1: Cash Donation
            doc.text("Cash Donation (Period)", 20, currentY + 12);
            doc.setFont("helvetica", "normal");
            doc.text(`Rs. ${fd.cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, currentY + 12, { align: "right" });
            doc.line(15, currentY + 20, 195, currentY + 20);

            // Row 2: Goods Value
            doc.setFont("helvetica", "bold");
            doc.text("Goods Value (Period)", 20, currentY + 32);
            doc.setFont("helvetica", "normal");
            doc.text(`Rs. ${fd.goods.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, currentY + 32, { align: "right" });
            doc.line(15, currentY + 40, 195, currentY + 40);

            // Row 3: Total Collection
            doc.setFont("helvetica", "bold");
            doc.setTextColor(30, 90, 168); // River Blue Highlight
            doc.text("Total Collection (Period)", 20, currentY + 52);
            doc.text(`Rs. ${fd.collection.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, currentY + 52, { align: "right" });
            doc.setTextColor(51, 65, 85);
            doc.line(15, currentY + 60, 195, currentY + 60);

            // Row 4: Total Expense
            doc.setFont("helvetica", "bold");
            doc.setTextColor(229, 57, 53); // Soft Red for Expense
            doc.text("Total Expenses (Period)", 20, currentY + 72);
            doc.text(`Rs. ${fd.expense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, currentY + 72, { align: "right" });

            // Row 5: Net Balance Card
            doc.setFillColor(30, 90, 168); // River Blue
            doc.rect(15, currentY + 90, 180, 20, "F");
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(255, 255, 255);
            doc.text("Current Balance (Overall)", 20, currentY + 103);
            doc.text(`Rs. ${fd.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, currentY + 103, { align: "right" });

            // Footer
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(46, 125, 50); // Nature Green
            doc.text("PRAJAPATI EKTA GROUP - SEVA HI SANKALP HAI", 105, 270, { align: "center" });

            // Save PDF
            doc.save(`Prajapati_Ekta_Group_Report_${getFormattedDate(today)}.pdf`);
        });
    }
}

// ================= UNIVERSAL SEARCH LOGIC =================
function initUniversalSearch() {
    const searchInput = document.getElementById("universalSearchInput");
    if (!searchInput) return;
    
    searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim().toLowerCase();
        filterListCards("tabMembersListContainer", query);
    });
}

function filterListCards(containerId, query) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const cards = container.children;
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (card.classList.contains("text-center")) continue; // Skip empty list message card
        
        const cardText = card.innerText.toLowerCase();
        if (cardText.includes(query)) {
            card.style.display = ""; // Show
        } else {
            card.style.display = "none"; // Hide
        }
    }
}

// ================= VOICE SEARCH LOGIC =================
function initVoiceSearch() {
    const voiceBtn = document.getElementById("voiceSearchBtn");
    const searchInput = document.getElementById("universalSearchInput");
    
    if (!voiceBtn || !searchInput) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceBtn.style.display = "none"; // Hide if speech recognition is not supported
        return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN'; // Hindi recognition
    recognition.continuous = false;
    recognition.interimResults = false;
    
    voiceBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        voiceBtn.classList.add("text-softRed", "animate-pulse");
        recognition.start();
    });
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        searchInput.value = transcript;
        // Trigger input event to filter list immediately
        searchInput.dispatchEvent(new Event('input'));
    };
    
    recognition.onspeechend = () => {
        recognition.stop();
        voiceBtn.classList.remove("text-softRed", "animate-pulse");
    };
    
    recognition.onerror = () => {
        voiceBtn.classList.remove("text-softRed", "animate-pulse");
    };
}

// ================= SETTINGS ADD MEMBER COLLAPSE LOGIC =================
function toggleSettingsAddMemberForm() {
    const form = document.getElementById("addMemberFormSettings");
    const icon = document.getElementById("settingsAddMemberFormIcon");
    if (form && icon) {
        const isHidden = form.classList.contains("hidden");
        if (isHidden) {
            form.classList.remove("hidden");
            icon.innerText = "expand_less";
        } else {
            form.classList.add("hidden");
            icon.innerText = "expand_more";
        }
    }
}

