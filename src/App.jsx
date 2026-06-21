import React, { useState, useEffect, useMemo, useRef } from 'react';
import CustomDropdown from './components/CustomDropdown.jsx';
import CustomCalendar from './components/CustomCalendar.jsx';

// API Base URL — .env से आएगा (dev: api/api.php, production: live URL)
const API_BASE = import.meta.env.VITE_API_BASE || 'api/api.php';

// Hindi Month names helper
const HINDI_MONTHS = [
  'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
];

export default function App() {
  // --- States ---
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('prajapati_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [appData, setAppData] = useState({
    dashboard: { total_cash: 0, total_goods: 0, total_collection: 0, total_expense: 0, current_balance: 0 },
    edit_locked: false,
    feed: [],
    contributions: [],
    expenses: [],
    members: []
  });

  const [currentActivePage, setCurrentActivePage] = useState('page-dashboard');
  const [reportFilters, setReportFilters] = useState({ year: 'all', month: 'all', type: 'all' });
  const [searchQuery, setSearchQuery] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);
  const [base64BillImage, setBase64BillImage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [recentlyAddedMember, setRecentlyAddedMember] = useState(null);

  // Custom Alert state
  const [customAlert, setCustomAlert] = useState({
    show: false,
    message: '',
    type: 'info',
    title: '',
    callback: null
  });

  // Modal display states
  const [modals, setModals] = useState({
    login: false,
    addContribution: false, // member-specific or general
    editContribution: false,
    expense: false, // add or edit
    memberDetail: false,
    billLightbox: false,
    addMember: false
  });

  // Selection states for modals
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedContribution, setSelectedContribution] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);

  // Form input states
  // 1. Login Form
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // 2. Add Contribution Form
  const [addContName, setAddContName] = useState('');
  const [addContMobile, setAddContMobile] = useState('');
  const [addContType, setAddContType] = useState('cash'); // 'cash' or 'goods'
  const [addContDate, setAddContDate] = useState(() => getFormattedDate(new Date()));
  const [addContRemark, setAddContRemark] = useState('');
  const [addCashAmount, setAddCashAmount] = useState('');
  const [addPaymentMode, setAddPaymentMode] = useState('cash'); // 'cash', 'upi', 'bank'
  const [addGoodsItemName, setAddGoodsItemName] = useState('');
  const [addGoodsQty, setAddGoodsQty] = useState('');
  const [addGoodsRate, setAddGoodsRate] = useState('');
  const [generalAddContMemberMobile, setGeneralAddContMemberMobile] = useState(''); // for dropdown member selection

  // 3. Edit Contribution Form
  const [editContName, setEditContName] = useState('');
  const [editContMobile, setEditContMobile] = useState('');
  const [editContType, setEditContType] = useState('cash');
  const [editContDate, setEditContDate] = useState('');
  const [editContRemark, setEditContRemark] = useState('');
  const [editCashAmount, setEditCashAmount] = useState('');
  const [editPaymentMode, setEditPaymentMode] = useState('cash');
  const [editGoodsItemName, setEditGoodsItemName] = useState('');
  const [editGoodsQty, setEditGoodsQty] = useState('');
  const [editGoodsRate, setEditGoodsRate] = useState('');

  // 4. Expense Form (Add / Edit)
  const [expAmount, setExpAmount] = useState('');
  const [expPaidTo, setExpPaidTo] = useState('');
  const [expDate, setExpDate] = useState(() => getFormattedDate(new Date()));
  const [expDesc, setExpDesc] = useState('');
  const [keepExistingImage, setKeepExistingImage] = useState(true);

  // 5. Add Member Form (Settings)
  const [settingsMemberName, setSettingsMemberName] = useState('');
  const [settingsMemberMobile, setSettingsMemberMobile] = useState('');

  // 6. Admin Edit Member Info Form (Inside Member Detail Modal)
  const [mDetEditName, setMDetEditName] = useState('');
  const [mDetEditMobile, setMDetEditMobile] = useState('');

  // 7. PIN Change Form
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [showOldPin, setShowOldPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [pinChangeLoading, setPinChangeLoading] = useState(false);

  // 8. Desktop Date/Time
  const [desktopDateText, setDesktopDateText] = useState('');
  const [desktopTimeText, setDesktopTimeText] = useState('');

  // 9. Lightbox Image
  const [lightboxImgSrc, setLightboxImgSrc] = useState('');

  const fileInputRef = useRef(null);

  // --- Helper Functions ---
  function getFormattedDate(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  }

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    return dateStr;
  };

  const formatDateDb = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    return dateStr;
  };

  const triggerAlert = (message, type = 'info', title = '', callback = null) => {
    const msgStr = String(message);
    const msgLower = msgStr.toLowerCase();
    let detectedType = type;
    if (type === 'info') {
      if (msgLower.includes("सफलतापूर्वक") || msgLower.includes("सफलता पूर्वक") || msgLower.includes("सफल") || msgLower.includes("सफलता") || msgLower.includes("success")) {
        detectedType = 'success';
      } else if (msgLower.includes("त्रुटि") || msgLower.includes("विफल") || msgLower.includes("समस्या") || msgLower.includes("गलत") || msgLower.includes("error") || msgLower.includes("fail") || msgLower.includes("invalid")) {
        detectedType = 'error';
      }
    }
    let defaultTitle = '';
    if (detectedType === 'success') defaultTitle = 'सफलता (Success)';
    else if (detectedType === 'error') defaultTitle = 'त्रुटि (Error)';
    else defaultTitle = 'सूचना (Notification)';

    setCustomAlert({
      show: true,
      message: msgStr,
      type: detectedType,
      title: title || defaultTitle,
      callback
    });
  };

  // --- API Calls ---
  const fetchLiveData = async (showIndicator = false) => {
    if (showIndicator) setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}?action=get_data`);
      const data = await res.json();
      if (data.success) {
        setAppData({
          dashboard: data.dashboard,
          edit_locked: data.edit_locked,
          feed: data.feed,
          contributions: data.contributions,
          expenses: data.expenses,
          members: data.members
        });
      }
    } catch (err) {
      console.error("Fetch live data error: ", err);
    } finally {
      if (showIndicator) setIsSyncing(false);
    }
  };

  // Polling Live Data
  useEffect(() => {
    fetchLiveData(true);
    const interval = setInterval(() => fetchLiveData(false), 3000);
    return () => clearInterval(interval);
  }, []);

  // Sync Desktop Top Bar Date/Time
  useEffect(() => {
    const hindiDays = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
    const hindiMonthsFull = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];

    function updateDateTime() {
      const now = new Date();
      setDesktopDateText(`${hindiDays[now.getDay()]}, ${now.getDate()} ${hindiMonthsFull[now.getMonth()]} ${now.getFullYear()}`);
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setDesktopTimeText(`${h}:${m}`);
    }

    updateDateTime();
    const interval = setInterval(updateDateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update specific forms when selection changes
  useEffect(() => {
    if (selectedMember) {
      setMDetEditName(selectedMember.name);
      setMDetEditMobile(selectedMember.mobile || '');
    }
  }, [selectedMember]);

  // Sync UI states for tabs (height constraints and scroll resetting)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.body.classList.remove("h-screen", "overflow-hidden");
  }, [currentActivePage]);

  // Computed Auto Totals
  const addGoodsAutoTotalVal = useMemo(() => {
    const qty = parseFloat(addGoodsQty) || 0;
    const rate = parseFloat(addGoodsRate) || 0;
    return qty * rate;
  }, [addGoodsQty, addGoodsRate]);

  const editGoodsAutoTotalVal = useMemo(() => {
    const qty = parseFloat(editGoodsQty) || 0;
    const rate = parseFloat(editGoodsRate) || 0;
    return qty * rate;
  }, [editGoodsQty, editGoodsRate]);

  // --- Auth Handlers ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (loginMobile.trim().length !== 10) {
      triggerAlert("कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें।", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: loginMobile.trim(), password: loginPassword.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
        localStorage.setItem('prajapati_user', JSON.stringify(data.user));
        setModals(prev => ({ ...prev, login: false }));
        setLoginMobile('');
        setLoginPassword('');
        fetchLiveData(true);
        triggerAlert("सफलतापूर्वक लॉगिन किया गया!");
      } else {
        triggerAlert(data.error || "लॉगिन विफल!", "error");
      }
    } catch (err) {
      console.error(err);
      triggerAlert("लॉगिन के दौरान त्रुटि हुई।", "error");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('prajapati_user');
    fetchLiveData(true);
    setCurrentActivePage('page-dashboard');
    triggerAlert("सफलतापूर्वक लॉगआउट किया गया!");
  };

  // --- Core CRUD Handlers ---

  // 1. Add Contribution
  const handleAddContributionSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      triggerAlert("योगदान जोड़ने के लिए कृपया पहले लॉगिन करें।", "error");
      return;
    }
    if (!addContName.trim() || !addContDate) {
      triggerAlert("नाम और तारीख आवश्यक हैं।", "error");
      return;
    }

    const payload = {
      user_mobile: currentUser.mobile,
      name: addContName.trim(),
      mobile: addContMobile.trim(),
      type: addContType,
      date: formatDateDb(addContDate),
      remark: addContRemark.trim()
    };

    if (addContType === 'cash') {
      const amt = parseFloat(addCashAmount) || 0;
      if (amt <= 0) {
        triggerAlert("कृपया वैध नकद राशि दर्ज करें।", "error");
        return;
      }
      payload.amount = amt;
      payload.payment_mode = addPaymentMode;
    } else {
      if (!addGoodsItemName.trim() || parseFloat(addGoodsQty) <= 0 || parseFloat(addGoodsRate) <= 0) {
        triggerAlert("सामग्री का नाम, मात्रा और दर सही ढंग से दर्ज करें।", "error");
        return;
      }
      payload.item_name = addGoodsItemName.trim();
      payload.quantity = parseFloat(addGoodsQty) || 0;
      payload.rate = parseFloat(addGoodsRate) || 0;
    }

    try {
      const res = await fetch(`${API_BASE}?action=add_contribution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        triggerAlert(data.message);
        setModals(prev => ({ ...prev, addContribution: false }));
        // Reset inputs
        setAddContName('');
        setAddContMobile('');
        setAddContType('cash');
        setAddContDate(getFormattedDate(new Date()));
        setAddContRemark('');
        setAddCashAmount('');
        setAddPaymentMode('cash');
        setAddGoodsItemName('');
        setAddGoodsQty('');
        setAddGoodsRate('');
        setGeneralAddContMemberMobile('');
        fetchLiveData(true);
      } else {
        triggerAlert(data.error || "योगदान जोड़ने में विफल!", "error");
      }
    } catch (err) {
      console.error(err);
      triggerAlert("योगदान जोड़ने में त्रुटि आई।", "error");
    }
  };

  // 2. Open Edit Contribution
  const openEditContribution = (item) => {
    setSelectedContribution(item);
    setEditContName(item.name);
    setEditContMobile(item.mobile || '');
    setEditContType(item.type);
    setEditContDate(formatDateDisplay(item.date));
    setEditContRemark(item.remark || '');
    setEditCashAmount(item.amount || '');
    setEditPaymentMode(item.payment_mode || 'cash');
    setEditGoodsItemName(item.item_name || '');
    setEditGoodsQty(item.quantity || '');
    setEditGoodsRate(item.rate || '');
    setModals(prev => ({ ...prev, editContribution: true }));
  };

  // 3. Edit Contribution Submit
  const handleEditContributionSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      triggerAlert("योगदान संशोधित करने के लिए कृपया पहले लॉगिन करें।", "error");
      return;
    }
    if (!selectedContribution) return;

    const payload = {
      user_mobile: currentUser.mobile,
      id: selectedContribution.id,
      name: editContName.trim(),
      mobile: editContMobile.trim(),
      type: editContType,
      date: formatDateDb(editContDate),
      remark: editContRemark.trim()
    };

    if (editContType === 'cash') {
      const amt = parseFloat(editCashAmount) || 0;
      if (amt <= 0) {
        triggerAlert("कृपया वैध नकद राशि दर्ज करें।", "error");
        return;
      }
      payload.amount = amt;
      payload.payment_mode = editPaymentMode;
    } else {
      if (!editGoodsItemName.trim() || parseFloat(editGoodsQty) <= 0 || parseFloat(editGoodsRate) <= 0) {
        triggerAlert("सामग्री का नाम, मात्रा और दर सही ढंग से दर्ज करें।", "error");
        return;
      }
      payload.item_name = editGoodsItemName.trim();
      payload.quantity = parseFloat(editGoodsQty) || 0;
      payload.rate = parseFloat(editGoodsRate) || 0;
    }

    try {
      const res = await fetch(`${API_BASE}?action=update_contribution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        triggerAlert(data.message);
        setModals(prev => ({ ...prev, editContribution: false }));
        setSelectedContribution(null);
        fetchLiveData(true);
      } else {
        triggerAlert(data.error || "योगदान संशोधित करने में विफल!", "error");
      }
    } catch (err) {
      console.error(err);
      triggerAlert("योगदान संशोधित करने में त्रुटि आई।", "error");
    }
  };

  // 4. Open Expense Modal (Add Mode)
  const openAddExpenseModal = () => {
    if (!currentUser) {
      triggerAlert("खर्च जोड़ने के लिए कृपया पहले लॉगिन करें।", "error");
      return;
    }
    setSelectedExpense(null);
    setExpAmount('');
    setExpPaidTo('');
    setExpDate(getFormattedDate(new Date()));
    setExpDesc('');
    setBase64BillImage('');
    if (fileInputRef.current) fileInputRef.current.value = "";
    setModals(prev => ({ ...prev, expense: true }));
  };

  // 5. Open Expense Modal (Edit Mode)
  const openEditExpenseModal = (item) => {
    if (!currentUser) {
      triggerAlert("खर्च संशोधित करने के लिए कृपया पहले लॉगिन करें।", "error");
      return;
    }
    setSelectedExpense(item);
    setExpAmount(item.amount);
    setExpPaidTo(item.paid_to);
    setExpDate(formatDateDisplay(item.date));
    setExpDesc(item.description || '');
    setBase64BillImage('');
    setKeepExistingImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setModals(prev => ({ ...prev, expense: true }));
  };

  // 6. Image Base64 compression on upload
  const handleBillImageUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBase64BillImage('loading'); // Show progress

      const reader = new FileReader();
      reader.onload = function(evt) {
        const img = new Image();
        img.onload = function() {
          const maxDim = 1000;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.85;
          let dataUrl = canvas.toDataURL("image/jpeg", quality);
          let sizeKB = (dataUrl.length * 3) / 4 / 1024;

          while (sizeKB > 50 && quality > 0.15) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL("image/jpeg", quality);
            sizeKB = (dataUrl.length * 3) / 4 / 1024;
          }

          let scale = 0.9;
          while (sizeKB > 50 && scale > 0.25) {
            const tempCanvas = document.createElement("canvas");
            const tempCtx = tempCanvas.getContext("2d");
            tempCanvas.width = Math.round(canvas.width * scale);
            tempCanvas.height = Math.round(canvas.height * scale);
            tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

            quality = 0.8;
            dataUrl = tempCanvas.toDataURL("image/jpeg", quality);
            sizeKB = (dataUrl.length * 3) / 4 / 1024;

            while (sizeKB > 50 && quality > 0.2) {
              quality -= 0.1;
              dataUrl = tempCanvas.toDataURL("image/jpeg", quality);
              sizeKB = (dataUrl.length * 3) / 4 / 1024;
            }
            scale -= 0.1;
          }

          setBase64BillImage(dataUrl);
          setKeepExistingImage(false);
        };
        img.onerror = function() {
          setBase64BillImage(evt.target.result);
          setKeepExistingImage(false);
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // 7. Expense Form Submit (Add & Edit)
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      triggerAlert("खर्च जोड़ने के लिए कृपया पहले लॉगिन करें।", "error");
      return;
    }
    const amt = parseFloat(expAmount) || 0;
    if (amt <= 0 || !expPaidTo.trim() || !expDate) {
      triggerAlert("राशि, भुगतान पाने वाले का नाम और तारीख आवश्यक हैं।", "error");
      return;
    }

    let url = `${API_BASE}?action=add_expense`;
    let bodyPayload = {
      user_mobile: currentUser.mobile,
      amount: amt,
      paid_to: expPaidTo.trim(),
      date: formatDateDb(expDate),
      description: expDesc.trim(),
      bill_image: base64BillImage === 'loading' ? '' : base64BillImage
    };

    if (selectedExpense) {
      url = `${API_BASE}?action=update_expense`;
      bodyPayload.id = selectedExpense.id;
      bodyPayload.keep_existing_image = keepExistingImage;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json();
      if (data.success) {
        triggerAlert(data.message);
        setModals(prev => ({ ...prev, expense: false }));
        // Reset
        setExpAmount('');
        setExpPaidTo('');
        setExpDate(getFormattedDate(new Date()));
        setExpDesc('');
        setBase64BillImage('');
        setSelectedExpense(null);
        fetchLiveData(true);
        setCurrentActivePage('page-reports');
      } else {
        triggerAlert(data.error || "खर्च सुरक्षित करने में विफल!", "error");
      }
    } catch (err) {
      console.error(err);
      triggerAlert("खर्च सुरक्षित करने में त्रुटि आई।", "error");
    }
  };

  // 8. Delete Entry
  const handleDeleteEntry = (id, type) => {
    if (!currentUser) {
      triggerAlert("कृपया प्रविष्टि हटाने के लिए लॉगिन करें।", "error");
      return;
    }
    if (window.confirm("क्या आप वाकई इस प्रविष्टि को हटाना चाहते हैं?")) {
      fetch(`${API_BASE}?action=delete_entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, user_mobile: currentUser.mobile })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          triggerAlert(data.message);
          // If deleted inside member details, we might need to refresh selectedMember summary as well
          if (selectedMember) {
            const updated = appData.members.find(m => m.id === selectedMember.id);
            if (updated) setSelectedMember(updated);
          }
          fetchLiveData(true);
        } else {
          triggerAlert(data.error || "हटाने में त्रुटि हुई।", "error");
        }
      })
      .catch(err => {
        console.error(err);
        triggerAlert("सर्वर से जुड़ने में समस्या हुई।", "error");
      });
    }
  };

  // 9. Toggle System Lock Edit Mode (Admin control)
  const handleToggleSystemEditMode = (isLocked) => {
    if (!currentUser || currentUser.is_admin !== 1) return;
    fetch(`${API_BASE}?action=toggle_edit_mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edit_locked: isLocked ? 1 : 0, user_mobile: currentUser.mobile })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        fetchLiveData(true);
        triggerAlert(`सिस्टम एडिट मोड सफलता पूर्वक ${isLocked ? "लॉक" : "अनलॉक"} किया गया।`);
      } else {
        triggerAlert(data.error || "संपादन मोड बदलने में विफल।", "error");
        fetchLiveData(false);
      }
    })
    .catch(err => {
      console.error(err);
      fetchLiveData(false);
    });
  };

  // 10. Toggle Member Access (Admin control)
  const handleToggleMemberAccess = (memberId, status) => {
    if (!currentUser || currentUser.is_admin !== 1) return;
    fetch(`${API_BASE}?action=toggle_member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, status: status ? 1 : 0, user_mobile: currentUser.mobile })
    })
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        triggerAlert(data.error || "स्टेटस बदलने में विफल।", "error");
      }
      fetchLiveData(true);
    })
    .catch(err => {
      console.error(err);
      fetchLiveData(false);
    });
  };

  // 11. Add Member (Settings Form)
  const handleAddMemberSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      triggerAlert("सदस्य जोड़ने के लिए कृपया पहले लॉगिन करें।", "error");
      return;
    }
    if (!settingsMemberName.trim() || !settingsMemberMobile.trim()) {
      triggerAlert("नाम और मोबाइल नंबर आवश्यक हैं।", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}?action=add_member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_mobile: currentUser.mobile,
          name: settingsMemberName.trim(),
          mobile: settingsMemberMobile.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerAlert(data.message);
        setRecentlyAddedMember({
          name: settingsMemberName.trim(),
          mobile: settingsMemberMobile.trim(),
          pin: settingsMemberMobile.trim().slice(-4)
        });
        setSettingsMemberName('');
        setSettingsMemberMobile('');
        fetchLiveData(true);
      } else {
        triggerAlert(data.error || "सदस्य जोड़ने में विफल!", "error");
      }
    } catch (err) {
      console.error(err);
      triggerAlert("सदस्य जोड़ने में त्रुटि आई।", "error");
    }
  };

  // 12. Admin Update Member Details (Inside Detail Modal)
  const handleAdminUpdateMemberSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || currentUser.is_admin !== 1 || !selectedMember) return;
    if (!mDetEditName.trim() || !mDetEditMobile.trim()) {
      triggerAlert("नाम और मोबाइल नंबर आवश्यक हैं।", "error");
      return;
    }
    if (!/^[0-9]{10}$/.test(mDetEditMobile.trim())) {
      triggerAlert("मोबाइल नंबर 10 अंकों का होना चाहिए।", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}?action=admin_update_member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_mobile: currentUser.mobile,
          member_id: selectedMember.id,
          name: mDetEditName.trim(),
          mobile: mDetEditMobile.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerAlert(data.message);
        setModals(prev => ({ ...prev, memberDetail: false }));
        setSelectedMember(null);
        // If editing own info
        if (selectedMember.id === currentUser.id) {
          const updatedUser = { ...currentUser, name: mDetEditName.trim(), mobile: mDetEditMobile.trim() };
          setCurrentUser(updatedUser);
          localStorage.setItem('prajapati_user', JSON.stringify(updatedUser));
        }
        fetchLiveData(true);
      } else {
        triggerAlert(data.error || "विवरण अपडेट करने में विफल!", "error");
      }
    } catch (err) {
      console.error(err);
      triggerAlert("अपडेट के दौरान त्रुटि हुई।", "error");
    }
  };

  // 13. Profile Update (Settings - Admin Update self)
  const handleAdminProfileUpdate = async (e) => {
    e.preventDefault();
    if (!currentUser || currentUser.is_admin !== 1) return;
    const nameEl = document.getElementById("profileNameInput");
    const mobileEl = document.getElementById("profileMobileInput");
    if (!nameEl || !mobileEl) return;
    const newName = nameEl.value.trim();
    const newMobile = mobileEl.value.trim();

    if (!newName || !newMobile) {
      triggerAlert("नाम और मोबाइल नंबर आवश्यक हैं।", "error");
      return;
    }
    if (!/^[0-9]{10}$/.test(newMobile)) {
      triggerAlert("मोबाइल नंबर 10 अंकों का होना चाहिए।", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}?action=update_profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_mobile: currentUser.mobile,
          new_name: newName,
          new_mobile: newMobile
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerAlert(data.message);
        setCurrentUser(data.user);
        localStorage.setItem('prajapati_user', JSON.stringify(data.user));
        fetchLiveData(true);
      } else {
        triggerAlert(data.error || "प्रोफ़ाइल अपडेट करने में विफल!", "error");
      }
    } catch (err) {
      console.error(err);
      triggerAlert("प्रोफ़ाइल अपडेट करने में त्रुटि हुई।", "error");
    }
  };

  // 14. Change PIN
  const handleChangePinSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      triggerAlert("PIN बदलने के लिए कृपया पहले लॉगिन करें।", "error");
      return;
    }
    if (newPinInput.trim() !== confirmPinInput.trim()) {
      triggerAlert("नया PIN और पुष्टि PIN मेल नहीं खाते हैं!", "error");
      return;
    }
    if (newPinInput.trim().length < 4 || newPinInput.trim().length > 6) {
      triggerAlert("नया PIN 4 से 6 अंकों का होना चाहिए।", "error");
      return;
    }

    setPinChangeLoading(true);
    try {
      const res = await fetch(`${API_BASE}?action=change_pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_mobile: currentUser.mobile,
          old_pin: oldPinInput.trim(),
          new_pin: newPinInput.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerAlert(data.message || "PIN सफलतापूर्वक बदल दिया गया है!");
        setOldPinInput('');
        setNewPinInput('');
        setConfirmPinInput('');
        setShowOldPin(false);
        setShowNewPin(false);
        setShowConfirmPin(false);
      } else {
        triggerAlert(data.error || "PIN बदलने में विफल!", "error");
      }
    } catch (err) {
      console.error(err);
      triggerAlert("PIN बदलने के दौरान कोई त्रुटि हुई।", "error");
    } finally {
      setPinChangeLoading(false);
    }
  };

  // 15. Clear System Cache
  const handleClearCache = () => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }
    if (window.caches) {
      caches.keys().then(names => {
        for (let name of names) {
          caches.delete(name);
        }
      });
    }
    triggerAlert("कैश साफ़ कर दिया गया है। ऐप अब अपडेट हो रहा है...", "success", "", () => {
      window.location.reload(true);
    });
  };

  // --- Voice Search logic ---
  const handleVoiceSearchToggle = (e) => {
    e.stopPropagation();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      triggerAlert("आवाज़ पहचान सेवा आपके ब्राउज़र में उपलब्ध नहीं है।", "error");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    setVoiceActive(true);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
    };

    recognition.onspeechend = () => {
      recognition.stop();
      setVoiceActive(false);
    };

    recognition.onerror = () => {
      setVoiceActive(false);
    };
  };

  // --- Filtered lists & totals calculations ---

  // Member Search Filter
  const filteredMembersList = useMemo(() => {
    const sorted = [...appData.members].sort((a, b) => {
      if (a.is_admin === 1 && b.is_admin !== 1) return -1;
      if (a.is_admin !== 1 && b.is_admin === 1) return 1;
      return a.name.localeCompare(b.name, 'hi');
    });

    const query = searchQuery.trim().toLowerCase();
    if (!query) return sorted;

    return sorted.filter(m => {
      const name = m.name.toLowerCase();
      const mobile = (m.mobile || '').toLowerCase();
      const words = name.split(/\s+/);
      const matchesName = name.includes(query);
      const matchesMobile = mobile.includes(query);
      const matchesFirstWord = words.some(word => word.startsWith(query));
      return matchesName || matchesMobile || matchesFirstWord;
    });
  }, [appData.members, searchQuery]);

  // Reports Filter Data
  const reportSummaryData = useMemo(() => {
    const filteredContributions = appData.contributions.filter(c => {
      if (reportFilters.type === 'expense') return false;
      if (!c.date) return false;
      const year = c.date.substring(0, 4);
      const month = c.date.substring(5, 7);
      const yearMatch = reportFilters.year === 'all' || year === reportFilters.year;
      const monthMatch = reportFilters.month === 'all' || month === reportFilters.month;
      return yearMatch && monthMatch;
    });

    const filteredExpenses = appData.expenses.filter(e => {
      if (reportFilters.type === 'income') return false;
      if (!e.date) return false;
      const year = e.date.substring(0, 4);
      const month = e.date.substring(5, 7);
      const yearMatch = reportFilters.year === 'all' || year === reportFilters.year;
      const monthMatch = reportFilters.month === 'all' || month === reportFilters.month;
      return yearMatch && monthMatch;
    });

    let combinedHistory = [];
    filteredContributions.forEach(c => {
      combinedHistory.push({
        ...c,
        item_type: 'contribution',
        timestamp: new Date(c.date).getTime() + c.id
      });
    });
    filteredExpenses.forEach(e => {
      combinedHistory.push({
        ...e,
        item_type: 'expense',
        timestamp: new Date(e.date).getTime() + e.id
      });
    });

    combinedHistory.sort((a, b) => b.timestamp - a.timestamp);

    // Calculate totals for period
    let periodCash = 0;
    let periodHandCash = 0;
    let periodOnlineCash = 0;
    let periodGoods = 0;
    let periodExpense = 0;

    filteredContributions.forEach(c => {
      if (c.type === 'cash') {
        periodCash += parseFloat(c.amount) || 0;
        if (c.payment_mode === 'cash') periodHandCash += parseFloat(c.amount) || 0;
        else periodOnlineCash += parseFloat(c.amount) || 0;
      } else {
        periodGoods += parseFloat(c.total_value) || 0;
      }
    });

    filteredExpenses.forEach(e => {
      periodExpense += parseFloat(e.amount) || 0;
    });

    const periodCollection = periodCash; // collection is liquid cash

    // Period description text
    let periodText = "अवधि: सभी समय";
    if (reportFilters.year !== 'all' || reportFilters.month !== 'all') {
      const yText = reportFilters.year !== 'all' ? reportFilters.year : '';
      const mText = reportFilters.month !== 'all' ? HINDI_MONTHS[parseInt(reportFilters.month, 10) - 1] : '';
      periodText = `अवधि: ${mText} ${yText}`.trim();
    }

    return {
      contributions: filteredContributions,
      expenses: filteredExpenses,
      history: combinedHistory,
      cash: periodCash,
      handCash: periodHandCash,
      onlineCash: periodOnlineCash,
      goods: periodGoods,
      expense: periodExpense,
      collection: periodCollection,
      balance: appData.dashboard.current_balance, // overall balance is shown
      periodText
    };
  }, [appData.contributions, appData.expenses, appData.dashboard, reportFilters]);

  // --- Reports Export Handlers ---
  const handlePdfExport = () => {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      triggerAlert("PDF library loader is still fetching, please wait.", "error");
      return;
    }
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const fd = reportSummaryData;

    // Border
    doc.setDrawColor(30, 90, 168);
    doc.setLineWidth(0.5);
    doc.rect(5, 5, 200, 287);

    // Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(30, 90, 168);
    doc.text("PRAJAPATI EKTA GROUP", 105, 20, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(46, 125, 50);
    doc.text("Ghaat Construction Financial Summary Report", 105, 27, { align: "center" });

    // Divider
    doc.setDrawColor(245, 230, 200);
    doc.setLineWidth(1);
    doc.line(15, 33, 195, 33);

    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated Date: ${getFormattedDate(new Date())}`, 15, 42);
    doc.text(`Period: ${fd.periodText}`, 195, 42, { align: "right" });

    // Table Block
    let currentY = 55;
    doc.setFillColor(245, 247, 250);
    doc.rect(15, currentY, 180, 60, "F");

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.rect(15, currentY, 180, 60);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(51, 65, 85);
    
    // Row 1: Cash Donation
    doc.text("Cash Donation (Period)", 20, currentY + 12);
    doc.setFont("helvetica", "normal");
    doc.text(`Rs. ${fd.cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, currentY + 12, { align: "right" });
    
    doc.setFontSize(9);
    doc.setTextColor(120, 130, 140);
    doc.text(`(Cash: Rs. ${fd.handCash.toLocaleString('en-IN')}, Online: Rs. ${fd.onlineCash.toLocaleString('en-IN')})`, 20, currentY + 17);
    doc.setFontSize(12);
    doc.setTextColor(51, 65, 85);
    doc.line(15, currentY + 20, 195, currentY + 20);

    // Row 2: Goods Value
    doc.setFont("helvetica", "bold");
    doc.text("Goods Value (Period)", 20, currentY + 32);
    doc.setFont("helvetica", "normal");
    doc.text(`Rs. ${fd.goods.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, currentY + 32, { align: "right" });
    doc.line(15, currentY + 40, 195, currentY + 40);

    // Row 3: Total Expense
    doc.setFont("helvetica", "bold");
    doc.setTextColor(229, 57, 53);
    doc.text("Total Expenses (Period)", 20, currentY + 52);
    doc.text(`Rs. ${fd.expense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, currentY + 52, { align: "right" });

    // Row 4: Net Balance Card
    doc.setFillColor(30, 90, 168);
    doc.rect(15, currentY + 70, 180, 20, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("Current Balance (Overall)", 20, currentY + 83);
    doc.text(`Rs. ${fd.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, currentY + 83, { align: "right" });

    // Footer
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(46, 125, 50);
    doc.text("PRAJAPATI EKTA GROUP - SEVA HI SANKALP HAI", 105, 270, { align: "center" });

    doc.save(`Prajapati_Ekta_Group_Report_${getFormattedDate(new Date())}.pdf`);
  };

  const handleWhatsappShare = () => {
    const fd = reportSummaryData;
    let historyText = "";

    if (fd.history.length > 0) {
      historyText = "\n\n📜 *लेनदेन विवरण (Transaction History):*";
      fd.history.forEach((item, index) => {
        const dateStr = formatDateDisplay(item.date);
        if (item.item_type === 'contribution') {
          if (item.type === 'cash') {
            const modeMap = { 'upi': 'UPI', 'bank': 'बैंक', 'cash': 'नकद' };
            const modeText = modeMap[item.payment_mode] || 'नकद';
            historyText += `\n${index + 1}. ➕ ${dateStr} - ${item.name}: +₹${Number(item.amount || 0).toLocaleString('en-IN')} (${modeText})`;
          } else {
            historyText += `\n${index + 1}. ➕ ${dateStr} - ${item.name}: +₹${Number(item.total_value || 0).toLocaleString('en-IN')} (सामग्री: ${item.item_name})`;
          }
        } else {
          historyText += `\n${index + 1}. ➖ ${dateStr} - ${item.paid_to}: -₹${Number(item.amount || 0).toLocaleString('en-IN')} (${item.description || 'खर्च'})`;
        }
      });
    }

    const formattedText = `🌿 *PRAJAPATI EKTA GROUP*
🌊 *Ghaat Construction Report*
📅 *अवधि:* ${fd.periodText}

💰 *नकद योगदान:* ₹${fd.cash.toLocaleString('en-IN')} (नकद: ₹${fd.handCash.toLocaleString('en-IN')}, ऑनलाइन: ₹${fd.onlineCash.toLocaleString('en-IN')})
🏗️ *सामग्री मूल्य:* ₹${fd.goods.toLocaleString('en-IN')}

📦 *कुल योगदान (अवधि):* ₹${fd.collection.toLocaleString('en-IN')}
💸 *कुल खर्च (अवधि):* ₹${fd.expense.toLocaleString('en-IN')}${historyText}

💰 *वर्तमान कुल शेष (Overall Balance):* ₹${fd.balance.toLocaleString('en-IN')}

🙏 धन्यवाद (सेवा ही संकल्प है)`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(formattedText)}`, '_blank');
  };

  // Member detail specific contribution history
  const selectedMemberHistory = useMemo(() => {
    if (!selectedMember) return [];
    return appData.contributions.filter(c => c.mobile && selectedMember.mobile && String(c.mobile).trim() === String(selectedMember.mobile).trim());
  }, [selectedMember, appData.contributions]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row text-slate-805">

      {/* Splash Screen (Simple React fade-out timer on mount) */}
      <SplashScreen />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-sandBeige/30 px-4 py-4 flex-shrink-0 h-screen sticky top-0 overflow-hidden">
        <div className="flex flex-col items-center text-center mb-4 pb-4 border-b border-sandBeige/30">
          <img src="logo.png" alt="Logo" className="w-14 h-14 object-contain rounded-full border border-sandBeige shadow-md mb-2" />
          <h2 className="text-base text-riverBlue font-semibold tracking-wide leading-tight">प्रजापति एकता ग्रुप</h2>
          <p className="text-[10px] text-natureGreen font-semibold mt-0.5">“एकता में शक्ति, सेवा में समर्पण”</p>
        </div>

        <nav className="flex-grow space-y-1">
          <button
            onClick={() => setCurrentActivePage('page-dashboard')}
            className={`sidebar-nav-item nav-item inline-flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all font-semibold text-[13px] text-left ${currentActivePage === 'page-dashboard' ? 'text-riverBlue bg-riverBlue/5' : 'text-slate-400 hover:text-riverBlue hover:bg-riverBlue/5'}`}
          >
            <span className="material-icons-outlined text-xl inline-flex items-center justify-center leading-none">home</span>
            <span className="inline-flex items-center leading-none transform translate-y-[1.5px]">डैशबोर्ड (Dashboard)</span>
          </button>
          <button
            onClick={() => setCurrentActivePage('page-members')}
            className={`sidebar-nav-item nav-item inline-flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all font-semibold text-[13px] text-left ${currentActivePage === 'page-members' ? 'text-riverBlue bg-riverBlue/5' : 'text-slate-400 hover:text-riverBlue hover:bg-riverBlue/5'}`}
          >
            <span className="material-icons-outlined text-xl inline-flex items-center justify-center leading-none">people</span>
            <span className="inline-flex items-center leading-none transform translate-y-[1.5px]">सदस्य (Members)</span>
          </button>
          <button
            onClick={() => setCurrentActivePage('page-reports')}
            className={`sidebar-nav-item nav-item inline-flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all font-semibold text-[13px] text-left ${currentActivePage === 'page-reports' ? 'text-riverBlue bg-riverBlue/5' : 'text-slate-400 hover:text-riverBlue hover:bg-riverBlue/5'}`}
          >
            <span className="material-icons-outlined text-xl inline-flex items-center justify-center leading-none">bar_chart</span>
            <span className="inline-flex items-center leading-none transform translate-y-[1.5px]">रिपोर्ट (Reports)</span>
          </button>
          <button
            onClick={() => setCurrentActivePage('page-settings')}
            className={`sidebar-nav-item nav-item inline-flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all font-semibold text-[13px] text-left ${currentActivePage === 'page-settings' ? 'text-riverBlue bg-riverBlue/5' : 'text-slate-400 hover:text-riverBlue hover:bg-riverBlue/5'}`}
          >
            <span className="material-icons-outlined text-xl inline-flex items-center justify-center leading-none">settings</span>
            <span className="inline-flex items-center leading-none transform translate-y-[1.5px]">सेटिंग्स (Settings)</span>
          </button>
        </nav>

        <div className="mt-auto pt-3 border-t border-sandBeige/30 space-y-2.5">
          {currentUser && currentActivePage === 'page-reports' && (
            <div>
              <button
                onClick={openAddExpenseModal}
                className="w-full bg-softRed text-white rounded-xl py-2.5 text-xs font-semibold hover:bg-softRed/95 transition-colors flex items-center justify-center gap-2 shadow-md"
              >
                <span className="material-icons-outlined text-base inline-flex items-center justify-center leading-none">payments</span>
                <span className="transform translate-y-[1.5px]">नया खर्च जोड़ें (Add Expense)</span>
              </button>
            </div>
          )}

          <div className="space-y-2.5">
            {!currentUser ? (
              <button
                onClick={() => setModals(prev => ({ ...prev, login: true }))}
                className="flex items-center justify-center gap-2 w-full bg-riverBlue text-white rounded-xl py-2.5 text-xs font-semibold hover:bg-riverBlue/95 transition-colors shadow-sm"
              >
                <span className="material-icons-outlined text-sm inline-flex items-center justify-center leading-none">login</span>
                <span className="transform translate-y-[1.5px]">लॉगिन करें (Login)</span>
              </button>
            ) : (
              <div className="flex items-center justify-between gap-2 w-full p-3 bg-lightGray rounded-xl border border-sandBeige/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-icons-outlined text-riverBlue text-lg">person</span>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-700 block truncate">{currentUser.name}</span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">
                      {currentUser.is_admin === 1 ? 'एडमिन' : 'सदस्य'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-softRed hover:text-softRed/80 flex items-center justify-center p-1 hover:bg-softRed/5 rounded-lg transition-colors"
                  title="लॉगआउट"
                >
                  <span className="material-icons-outlined text-base">logout</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold px-1">
            <span className="flex items-center gap-1">
              {isSyncing && (
                <span className="text-natureGreen animate-pulse">
                  <span className="material-icons-outlined text-base">sync</span>
                </span>
              )}
              <span>सिस्टम सिंक</span>
            </span>
            <span className="text-[10px] text-slate-400">प्रजापति एकता</span>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Desktop Top Bar */}
        <div className="hidden md:flex desktop-top-bar sticky top-0 z-45 px-8 py-4 items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg text-riverBlue font-medium tracking-wide">
              {currentActivePage === 'page-dashboard' && 'डैशबोर्ड (Dashboard)'}
              {currentActivePage === 'page-members' && 'सदस्य (Members)'}
              {currentActivePage === 'page-reports' && 'रिपोर्ट (Reports)'}
              {currentActivePage === 'page-settings' && 'सेटिंग्स (Settings)'}
            </h2>
            <p className="text-[11px] text-slate-450 font-medium mt-0.5">🌿 प्रजापति एकता ग्रुप में आपका स्वागत है</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-slate-500 font-medium block">{desktopDateText}</span>
              <span className="text-[10px] text-slate-400 block">{desktopTimeText}</span>
            </div>
            <div className="w-px h-8 bg-sandBeige/40"></div>
            {isSyncing && (
              <span className="text-natureGreen animate-pulse">
                <span className="material-icons-outlined text-xl">sync</span>
              </span>
            )}
          </div>
        </div>

        {/* Mobile App Header */}
        <header className="bg-white sticky top-0 z-40 shadow-sm border-b border-sandBeige/20 pt-6 pb-4 px-4 flex-shrink-0 md:hidden">
          <div className="max-w-md mx-auto flex flex-col items-center relative">
            <div className="absolute left-0 top-2">
              {isSyncing && (
                <span className="text-natureGreen animate-pulse">
                  <span className="material-icons-outlined text-[26px]">sync</span>
                </span>
              )}
            </div>

            <div className="absolute right-0 top-2">
              {!currentUser ? (
                <button
                  onClick={() => setModals(prev => ({ ...prev, login: true }))}
                  className="flex items-center justify-center p-2 rounded-full hover:bg-lightGray text-riverBlue transition-colors"
                >
                  <span className="material-icons-outlined text-[26px]">login</span>
                </button>
              ) : (
                <button
                  onClick={() => setCurrentActivePage('page-settings')}
                  className="flex items-center justify-center p-2 rounded-full hover:bg-lightGray text-riverBlue transition-colors"
                >
                  <span className="material-icons-outlined text-[26px]">person</span>
                </button>
              )}
            </div>

            <img src="logo.png" alt="Logo" className="w-16 h-16 object-contain rounded-full border border-sandBeige shadow-sm mb-2" />
            <h1 className="text-2xl text-riverBlue font-medium tracking-wide text-center">प्रजापति एकता ग्रुप</h1>
            <p className="text-sm text-natureGreen font-medium mt-1 text-center">“एकता में शक्ति, सेवा में समर्पण”</p>
          </div>
        </header>

        {/* Main View Container */}
        <main className={`flex-1 flex flex-col max-w-md md:max-w-none mx-auto w-full px-4 lg:px-8 pt-4 pb-12 md:pb-6 ${currentActivePage === 'page-members' ? 'lg:overflow-hidden' : ''}`}>

          {/* PAGE 1: DASHBOARD */}
          {currentActivePage === 'page-dashboard' && (
            <section className="page-view active animate-ripple flex-1 flex flex-col pt-2 pb-32 md:pb-6">
              <div className="flex flex-col gap-6 mt-3">
                
                {/* Dashboard Summary Cards */}
                <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  {/* Total Cash Card */}
                  <div className="bg-gradient-to-br from-[#1E5AA8] via-[#2D73CE] to-[#103E79] p-5 rounded-2xl shadow-[0_10px_25px_rgba(30,90,168,0.22)] border border-white/10 relative overflow-hidden col-span-2 lg:col-span-1 flex flex-col justify-between h-48 text-white hover:scale-[1.01] hover:shadow-[0_18px_40px_rgba(30,90,168,0.28)] transition-all duration-350">
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 pointer-events-none"></div>
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="flex justify-between items-start z-10">
                      <div>
                        <span className="text-[9px] uppercase tracking-widest opacity-80 block font-semibold">नकद दान कार्ड • CASH CARD</span>
                        <span className="text-xs font-medium block mt-0.5">💰 कुल नकद दान</span>
                      </div>
                      <div className="w-9 h-6.5 bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 rounded-md border border-amber-600/30 flex items-center justify-center overflow-hidden shadow-inner">
                        <div className="grid grid-cols-3 gap-0.5 w-full h-full p-1 opacity-75">
                          <div className="border-r border-b border-amber-850/30"></div>
                          <div className="border-r border-b border-amber-850/30"></div>
                          <div className="border-b border-amber-850/30"></div>
                          <div className="border-r border-amber-850/30"></div>
                          <div className="border-r border-amber-850/30"></div>
                          <div className="border-amber-850/30"></div>
                        </div>
                      </div>
                    </div>
                    <div className="my-3 z-10 flex flex-col">
                      <div className="text-4xl font-bold tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)] text-white">
                        ₹{appData.dashboard.total_cash.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] font-medium opacity-90 mt-1 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
                        नकद (Cash): ₹{appData.contributions.filter(c => c.type === 'cash' && c.payment_mode === 'cash').reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0).toLocaleString('en-IN')} | ऑनलाइन (Online): ₹{appData.contributions.filter(c => c.type === 'cash' && c.payment_mode !== 'cash').reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="flex justify-between items-end z-10 pt-1.5 border-t border-white/10">
                      <div>
                        <span className="text-[8px] uppercase tracking-wider opacity-60 block">Card Holder</span>
                        <span className="text-[11px] font-semibold tracking-wide">🌿 प्रजापति एकता ग्रुप</span>
                      </div>
                      <span className="text-[10px] font-bold tracking-widest bg-white/10 px-2 py-0.5 rounded uppercase">Collection</span>
                    </div>
                  </div>

                  {/* Total Goods Card */}
                  <div className="bg-gradient-to-br from-[#2E7D32] to-[#1B5E20] p-4 md:p-5 flex flex-col justify-between h-36 md:h-48 rounded-2xl shadow-[0_8px_20px_rgba(46,125,50,0.22)] border border-white/10 relative overflow-hidden text-white col-span-1 lg:col-span-1 hover:scale-[1.01] hover:shadow-[0_18px_40px_rgba(46,125,50,0.28)] transition-all duration-350">
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 pointer-events-none"></div>
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none hidden md:block"></div>
                    <div className="flex justify-between items-start z-10">
                      <div>
                        <span className="text-[8px] md:text-[9px] uppercase tracking-wider opacity-75 block font-semibold">GOODS • सामग्री</span>
                        <span className="text-[10px] md:text-xs font-medium block mt-0.5">🏗️ कुल सामग्री मूल्य</span>
                      </div>
                      <div className="w-7 h-5 md:w-9 md:h-6.5 bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 rounded-sm md:rounded-md border border-amber-600/30 flex items-center justify-center overflow-hidden shadow-inner">
                        <div className="grid grid-cols-3 gap-0.5 w-full h-full p-0.5 opacity-75">
                          <div className="border-r border-b border-amber-850/30"></div>
                          <div className="border-r border-b border-amber-850/30"></div>
                          <div className="border-b border-amber-850/30"></div>
                          <div className="border-r border-amber-850/30"></div>
                          <div className="border-r border-amber-850/30"></div>
                          <div className="border-amber-850/30"></div>
                        </div>
                      </div>
                    </div>
                    <div className="my-1.5 md:my-3 z-10 flex flex-col">
                      <div className="text-2xl md:text-4xl font-bold tracking-wide drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.45)] text-white">
                        ₹{appData.dashboard.total_goods.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="flex justify-between items-end z-10 pt-1 md:pt-1.5 border-t border-white/10">
                      <div className="hidden md:block">
                        <span className="text-[8px] uppercase tracking-wider opacity-60 block">Card Holder</span>
                        <span className="text-[11px] font-semibold tracking-wide">🌿 प्रजापति एकता ग्रुप</span>
                      </div>
                      <span className="text-[9px] font-medium tracking-wide opacity-80 md:hidden">🌿 प्रजापति एकता</span>
                      <span className="material-icons-outlined text-white/80 text-sm md:hidden">inventory_2</span>
                    </div>
                  </div>

                  {/* Total Expense Card */}
                  <div className="bg-gradient-to-br from-[#E53935] to-[#B71C1C] p-4 md:p-5 flex flex-col justify-between h-36 md:h-48 rounded-2xl shadow-[0_8px_20px_rgba(229,57,53,0.22)] border border-white/10 relative overflow-hidden text-white col-span-1 lg:col-span-1 hover:scale-[1.01] hover:shadow-[0_18px_40px_rgba(229,57,53,0.28)] transition-all duration-350">
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 pointer-events-none"></div>
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none hidden md:block"></div>
                    <div className="flex justify-between items-start z-10">
                      <div>
                        <span className="text-[8px] md:text-[9px] uppercase tracking-wider opacity-75 block font-semibold">EXPENSE • खर्च</span>
                        <span className="text-[10px] md:text-xs font-medium block mt-0.5">💸 कुल खर्च</span>
                      </div>
                      <div className="w-7 h-5 md:w-9 md:h-6.5 bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 rounded-sm md:rounded-md border border-amber-600/30 flex items-center justify-center overflow-hidden shadow-inner">
                        <div className="grid grid-cols-3 gap-0.5 w-full h-full p-0.5 opacity-75">
                          <div className="border-r border-b border-amber-850/30"></div>
                          <div className="border-r border-b border-amber-850/30"></div>
                          <div className="border-b border-amber-850/30"></div>
                          <div className="border-r border-amber-850/30"></div>
                          <div className="border-r border-amber-850/30"></div>
                          <div className="border-amber-850/30"></div>
                        </div>
                      </div>
                    </div>
                    <div className="my-1.5 md:my-3 z-10 flex flex-col">
                      <div className="text-2xl md:text-4xl font-bold tracking-wide drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.45)] text-white">
                        ₹{appData.dashboard.total_expense.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="flex justify-between items-end z-10 pt-1 md:pt-1.5 border-t border-white/10">
                      <div className="hidden md:block">
                        <span className="text-[8px] uppercase tracking-wider opacity-60 block">Card Holder</span>
                        <span className="text-[11px] font-semibold tracking-wide">🌿 प्रजापति एकता ग्रुप</span>
                      </div>
                      <span className="text-[9px] font-medium tracking-wide opacity-80 md:hidden">🌿 प्रजापति एकता</span>
                      <span className="material-icons-outlined text-white/80 text-sm md:hidden">payments</span>
                    </div>
                  </div>

                  {/* Current Balance Card */}
                  <div className="bg-gradient-to-br from-[#105E3D] via-[#1E7C53] to-[#0A3D26] p-5 rounded-2xl shadow-[0_10px_25px_rgba(16,94,61,0.22)] border border-white/10 relative overflow-hidden col-span-2 lg:col-span-1 flex flex-col justify-between h-48 text-white hover:scale-[1.01] hover:shadow-[0_18px_40px_rgba(16,94,61,0.28)] transition-all duration-350">
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 pointer-events-none"></div>
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="flex justify-between items-start z-10">
                      <div>
                        <span className="text-[9px] uppercase tracking-widest opacity-80 block font-semibold">शेष राशि कार्ड • BALANCE CARD</span>
                        <span className="text-xs font-medium block mt-0.5">💰 वर्तमान शेष राशि</span>
                      </div>
                      <div className="w-9 h-6.5 bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 rounded-md border border-amber-600/30 flex items-center justify-center overflow-hidden shadow-inner">
                        <div className="grid grid-cols-3 gap-0.5 w-full h-full p-1 opacity-75">
                          <div className="border-r border-b border-amber-850/30"></div>
                          <div className="border-r border-b border-amber-850/30"></div>
                          <div className="border-b border-amber-850/30"></div>
                          <div className="border-r border-amber-850/30"></div>
                          <div className="border-r border-amber-850/30"></div>
                          <div className="border-amber-850/30"></div>
                        </div>
                      </div>
                    </div>
                    <div className="my-3 z-10 flex flex-col">
                      <div className="text-4xl font-bold tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)] text-white">
                        ₹{appData.dashboard.current_balance.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="flex justify-between items-end z-10 pt-1.5 border-t border-white/10">
                      <div>
                        <span className="text-[8px] uppercase tracking-wider opacity-60 block">Card Holder</span>
                        <span className="text-[11px] font-semibold tracking-wide">🌿 प्रजापति एकता ग्रुप</span>
                      </div>
                      <span className="text-[10px] font-bold tracking-widest bg-white/10 px-2 py-0.5 rounded uppercase">SAVINGS</span>
                    </div>
                  </div>

                </div>

                {/* Recent Activity Section (Full Width, below cards) */}
                <div className="w-full bg-white p-5 rounded-2xl shadow-sm border border-sandBeige/30">
                  <h3 className="text-md font-semibold text-slate-800 mb-4 pb-2 border-b border-lightGray flex items-center gap-1.5">
                    <span className="material-icons-outlined text-riverBlue text-lg">history</span>
                    हालिया गतिविधियां (Recent Activity)
                  </h3>
                  
                  {appData.feed.length === 0 ? (
                    <div className="text-center text-slate-400 py-8 text-xs">कोई गतिविधि नहीं मिली</div>
                  ) : (
                    <>
                      {/* Desktop Table View */}
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-lightGray text-[13px] font-semibold text-slate-500">
                              <th className="py-3 px-4">प्रकार (Type)</th>
                              <th className="py-3 px-4">सदस्य / विवरण (Name / Details)</th>
                              <th className="py-3 px-4">तारीख (Date)</th>
                              <th className="py-3 px-4 text-right">राशि (Amount)</th>
                              <th className="py-3 px-4 text-center">लिंक / एक्शन (Link / Action)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-lightGray/50 text-sm">
                            {appData.feed.map((item, idx) => {
                              const isContribution = item.feed_type === 'contribution';
                              const matchedMember = item.mobile 
                                ? appData.members.find(m => m.mobile === item.mobile) 
                                : appData.members.find(m => m.name === item.name);
                              
                              return (
                                <tr key={idx} className="hover:bg-lightGray/35 transition-colors">
                                  <td className="py-3 px-4">
                                    {isContribution ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-riverBlue/10 text-riverBlue font-semibold">
                                        ➕ योगदान
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-softRed/10 text-softRed font-semibold">
                                        ➖ खर्च
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-semibold text-slate-800">
                                      {isContribution && matchedMember ? (
                                        <button
                                          onClick={() => {
                                            setSelectedMember(matchedMember);
                                            setModals(prev => ({ ...prev, memberDetail: true }));
                                          }}
                                          className="hover:text-riverBlue hover:underline text-left font-semibold text-riverBlue inline-flex items-center gap-0.5"
                                          title="सदस्य विवरण देखें"
                                        >
                                          {item.name}
                                          <span className="material-icons-outlined text-[12px]">open_in_new</span>
                                        </button>
                                      ) : (
                                        item.name
                                      )}
                                    </div>
                                    <div className="text-[11.5px] text-slate-400 mt-0.5">
                                      {isContribution ? (
                                        item.type === 'cash' ? `💵 नकद` : `🏗️ सामग्री: ${item.item_name}`
                                      ) : (
                                        `विवरण: ${item.item_name || 'उपलब्ध नहीं'}`
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-slate-550 font-medium">
                                    📅 {formatDateDisplay(item.date)}
                                  </td>
                                  <td className={`py-3 px-4 text-right font-bold ${isContribution ? 'text-riverBlue' : 'text-softRed'}`}>
                                    {isContribution ? (
                                      item.type === 'cash' ? `+₹${item.amount.toLocaleString('en-IN')}` : `+₹${item.total_value.toLocaleString('en-IN')}`
                                    ) : (
                                      `-₹${item.amount.toLocaleString('en-IN')}`
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    {isContribution && matchedMember && (
                                      <button
                                        onClick={() => {
                                          setSelectedMember(matchedMember);
                                          setModals(prev => ({ ...prev, memberDetail: true }));
                                        }}
                                        className="text-xs text-riverBlue hover:underline font-semibold inline-flex items-center gap-1 hover:text-riverBlue/85"
                                      >
                                        <span className="material-icons-outlined text-sm">person</span>
                                        सदस्य प्रोफ़ाइल
                                      </button>
                                    )}
                                    {!isContribution && item.bill_image && (
                                      <button
                                        onClick={() => {
                                          setLightboxImgSrc(item.bill_image);
                                          setModals(prev => ({ ...prev, billLightbox: true }));
                                        }}
                                        className="text-xs text-riverBlue hover:underline font-semibold inline-flex items-center gap-1 hover:text-riverBlue/85"
                                      >
                                        <span className="material-icons-outlined text-sm">image</span>
                                        रसीद देखें
                                      </button>
                                    )}
                                    {!isContribution && !item.bill_image && (
                                      <span className="text-xs text-slate-400 italic">रसीद नहीं है</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile List View */}
                      <div className="lg:hidden space-y-3 max-h-[30rem] overflow-y-auto pr-1">
                        {appData.feed.map((item, idx) => {
                          const isContribution = item.feed_type === 'contribution';
                          const matchedMember = item.mobile 
                            ? appData.members.find(m => m.mobile === item.mobile) 
                            : appData.members.find(m => m.name === item.name);
                          
                          return (
                            <div key={idx} className="p-3.5 bg-lightGray rounded-xl border border-sandBeige/10 text-xs flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-750 block truncate">
                                  {isContribution ? (
                                    matchedMember ? (
                                      <button
                                        onClick={() => {
                                          setSelectedMember(matchedMember);
                                          setModals(prev => ({ ...prev, memberDetail: true }));
                                        }}
                                        className="hover:text-riverBlue hover:underline text-left font-semibold text-riverBlue inline-flex items-center gap-0.5"
                                      >
                                        ➕ {item.name}
                                        <span className="material-icons-outlined text-[10px]">open_in_new</span>
                                      </button>
                                    ) : (
                                      `➕ ${item.name}`
                                    )
                                  ) : (
                                    `➖ ${item.name}`
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  {isContribution ? (
                                    item.type === 'cash' ? `नकद योगदान` : `सामग्री: ${item.item_name}`
                                  ) : (
                                    `खर्च: ${item.item_name || 'विवरण उपलब्ध नहीं'}`
                                  )}
                                </span>
                                <span className="text-[9px] text-slate-400 block mt-0.5">📅 {formatDateDisplay(item.date)}</span>
                                
                                <div className="mt-1.5 flex gap-2">
                                  {isContribution && matchedMember && (
                                    <button
                                      onClick={() => {
                                        setSelectedMember(matchedMember);
                                        setModals(prev => ({ ...prev, memberDetail: true }));
                                      }}
                                      className="text-[10.5px] text-riverBlue font-medium inline-flex items-center gap-0.5 hover:underline"
                                    >
                                      <span className="material-icons-outlined text-[11px]">person</span> सदस्य प्रोफ़ाइल
                                    </button>
                                  )}
                                  {!isContribution && item.bill_image && (
                                    <button
                                      onClick={() => {
                                        setLightboxImgSrc(item.bill_image);
                                        setModals(prev => ({ ...prev, billLightbox: true }));
                                      }}
                                      className="text-[10.5px] text-riverBlue font-medium inline-flex items-center gap-0.5 hover:underline"
                                    >
                                      <span className="material-icons-outlined text-[11px]">image</span> रसीद देखें
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className={`font-bold block ${isContribution ? 'text-riverBlue' : 'text-softRed'}`}>
                                  {isContribution ? (
                                    item.type === 'cash' ? `+₹${item.amount.toLocaleString('en-IN')}` : `+₹${item.total_value.toLocaleString('en-IN')}`
                                  ) : (
                                    `-₹${item.amount.toLocaleString('en-IN')}`
                                  )}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

              </div>
            </section>
          )}

          {/* PAGE 2: MEMBERS */}
          {currentActivePage === 'page-members' && (
            <section className="page-view active animate-ripple flex-1 flex flex-col lg:overflow-hidden pb-36 md:pb-6">
              
              {/* Members List */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-sandBeige/30 flex-1 flex flex-col lg:overflow-hidden mb-0">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-lightGray flex-shrink-0">
                  <h3 className="text-md text-riverBlue font-medium inline-flex items-center gap-2">
                    <span className="material-icons-outlined inline-flex items-center justify-center leading-none text-lg">people</span>
                    सदस्य सूची (Members List)
                  </h3>
                  <div className="flex items-center gap-3">
                    {currentUser && (
                      <button
                        onClick={() => setModals(prev => ({ ...prev, addMember: true }))}
                        className="hidden lg:inline-flex bg-riverBlue hover:bg-riverBlue/95 text-white text-xs font-semibold px-3 rounded-xl items-center justify-center gap-1.5 transition-colors shadow-sm h-8"
                      >
                        <span className="material-icons-outlined text-sm inline-flex items-center justify-center leading-none">person_add</span>
                        <span className="transform translate-y-[1.5px]">सदस्य जोड़ें (Add Member)</span>
                      </button>
                    )}
                    <span className="text-xs text-slate-500 font-medium">कुल सदस्य: {appData.members.length}</span>
                  </div>
                </div>

                {/* Desktop View Table */}
                <div className="hidden lg:block overflow-y-auto flex-1 p-1">
                  {filteredMembersList.length === 0 ? (
                    <div className="text-center text-slate-400 py-8 text-xs">कोई सदस्य नहीं मिला</div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-lightGray text-[13px] font-semibold text-slate-500">
                          <th className="py-3 px-4 align-middle">सदस्य (Member)</th>
                          <th className="py-3 px-4 align-middle">मोबाइल नंबर (Mobile)</th>
                          <th className="py-3 px-4 align-middle">पद (Role)</th>
                          <th className="py-3 px-4 text-right align-middle">कुल दान (Contribution)</th>
                          <th className="py-3 px-4 text-center align-middle">एक्शन (Action)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-lightGray/50 text-sm">
                        {filteredMembersList.map((m) => {
                          return (
                            <tr
                              key={m.id}
                              onClick={() => {
                                setSelectedMember(m);
                                setModals(prev => ({ ...prev, memberDetail: true }));
                              }}
                              className="hover:bg-lightGray/35 transition-colors cursor-pointer"
                            >
                              <td className="py-3 px-4 align-middle">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs border overflow-hidden ${
                                    m.is_admin === 1
                                      ? 'bg-amber-100 text-amber-700 border-amber-300 font-bold'
                                      : m.status === 1
                                      ? 'bg-riverBlue/10 text-riverBlue border-riverBlue/25'
                                      : 'bg-slate-100 text-slate-500 border-slate-200/50'
                                  }`}>
                                    {(m.status === 1 || m.is_admin === 1) ? (
                                      <img src="logo.png" className="w-full h-full object-cover" alt="Active" />
                                    ) : (
                                      m.name.charAt(0)
                                    )}
                                  </div>
                                  <div className="inline-flex items-center">
                                    <span className={`font-semibold text-slate-800 inline-flex items-center gap-1.5 ${m.is_admin === 1 ? 'text-amber-800 font-bold' : ''}`}>
                                      {m.name}
                                      {m.status === 1 && (
                                        <span className="inline-flex items-center text-[9px] bg-natureGreen/10 text-natureGreen px-1.5 py-0.5 rounded-full font-medium border border-natureGreen/20 leading-none">
                                          ✅ <span className="transform translate-y-[1px] ml-0.5">सक्रिय</span>
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-600 font-medium align-middle">
                                {m.mobile}
                              </td>
                              <td className="py-3 px-4 align-middle">
                                {m.is_admin === 1 ? (
                                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold border border-amber-200 inline-flex items-center justify-center leading-none"><span className="transform translate-y-[1.5px]">एडमिन (Admin)</span></span>
                                ) : (
                                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-medium inline-flex items-center justify-center leading-none"><span className="transform translate-y-[1.5px]">सदस्य (Member)</span></span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-riverBlue align-middle">
                                ₹{m.overall_total.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-4 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-center gap-2">
                                  {currentUser && (
                                    <button
                                      onClick={() => {
                                        setAddContName(m.name);
                                        setAddContMobile(m.mobile || '');
                                        setAddContDate(getFormattedDate(new Date()));
                                        setModals(prev => ({ ...prev, addContribution: true }));
                                      }}
                                      className="bg-riverBlue hover:bg-riverBlue/95 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1 transition-colors h-7 px-2.5"
                                    >
                                      <span className="material-icons-outlined text-[11px] inline-flex items-center justify-center leading-none">add_circle</span>
                                      <span className="transform translate-y-[1.5px]">योगदान</span>
                                    </button>
                                  )}
                                  <a
                                    href={`tel:${m.mobile}`}
                                    className="bg-natureGreen/10 hover:bg-natureGreen/25 text-natureGreen border border-natureGreen/25 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1 transition-colors h-7 px-2.5"
                                  >
                                    <span className="material-icons-outlined text-[11px] inline-flex items-center justify-center leading-none">call</span>
                                    <span className="transform translate-y-[1.5px]">कॉल</span>
                                  </a>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Mobile View Grid */}
                <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 overflow-y-auto p-1 flex-1">
                  {filteredMembersList.length === 0 ? (
                    <div className="text-center text-slate-400 py-8 text-xs col-span-full">कोई सदस्य नहीं मिला</div>
                  ) : (
                    filteredMembersList.map((m) => {
                      const isSelf = currentUser && currentUser.id === m.id;
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            setSelectedMember(m);
                            setModals(prev => ({ ...prev, memberDetail: true }));
                          }}
                          className={`p-4 rounded-2xl cursor-pointer flex flex-col transition-all duration-300 hover:translate-y-[-2px] hover:shadow-lg ${
                            m.is_admin === 1
                              ? 'bg-gradient-to-tr from-[#FFFDF8] via-white to-[#FDF5E2] border-amber-300 shadow-[0_6px_18px_rgba(217,119,6,0.08)] hover:border-amber-400 scale-[1.01] border-2'
                              : m.status === 1
                              ? 'bg-gradient-to-tr from-white via-white to-riverBlue/[0.03] border-riverBlue/30 shadow-[0_4px_15px_rgba(30,90,168,0.05)] hover:border-riverBlue/45 scale-[1.01]'
                              : 'bg-white border border-sandBeige/20 shadow-[0_2px_8px_rgba(0,0,0,0.02)]'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm border overflow-hidden ${
                                m.is_admin === 1
                                  ? 'bg-amber-100 text-amber-700 border-amber-300 font-bold text-lg'
                                  : m.status === 1
                                  ? 'bg-riverBlue/10 text-riverBlue border-riverBlue/25'
                                  : 'bg-slate-100 text-slate-500 border-slate-200/50'
                              }`}>
                                {(m.status === 1 || m.is_admin === 1) ? (
                                  <img src="logo.png" className="w-full h-full object-cover" alt="Active" />
                                ) : (
                                  m.name.charAt(0)
                                )}
                              </div>
                              <div>
                                <div className={`text-[14.5px] font-semibold flex items-center gap-1.5 ${m.is_admin === 1 ? 'text-slate-800 text-[15.5px] font-bold' : 'text-slate-700'}`}>
                                  {m.name}
                                  {m.status === 1 && (
                                    <span className="text-[9.5px] bg-natureGreen/10 text-natureGreen px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 border border-natureGreen/20">
                                      ✅ <span className="transform translate-y-[1px]">सक्रिय</span>
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-450 mt-1 flex items-center gap-1.5">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 flex-shrink-0">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                  </svg>
                                  <span className="transform translate-y-[0.5px]">{m.mobile}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[15.5px] font-bold text-riverBlue">₹{m.overall_total.toLocaleString('en-IN')}</div>
                              <div className="text-[9px] text-slate-400 font-medium tracking-wide uppercase">कुल दान</div>
                            </div>
                          </div>
                          <div className="border-t border-slate-100 my-2"></div>
                          <div className="flex items-center gap-3 mt-2">
                            {currentUser && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAddContName(m.name);
                                  setAddContMobile(m.mobile || '');
                                  setAddContDate(getFormattedDate(new Date()));
                                  setModals(prev => ({ ...prev, addContribution: true }));
                                }}
                                className="flex-1 h-10 bg-riverBlue hover:bg-riverBlue/95 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                              >
                                <span className="material-icons-outlined text-xs inline-flex items-center justify-center leading-none">add_circle</span>
                                <span className="transform translate-y-[1.5px]">योगदान</span>
                              </button>
                            )}
                            <a
                              href={`tel:${m.mobile}`}
                              onClick={(e) => e.stopPropagation()}
                              className={`${currentUser ? 'w-10 h-10 flex-shrink-0' : 'w-full h-10'} bg-natureGreen/10 hover:bg-natureGreen/25 text-natureGreen border border-natureGreen/25 rounded-xl flex items-center justify-center transition-colors`}
                              title="कॉल करें"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Sticky Search bar */}
              <div className="fixed bottom-[88px] left-4 right-4 z-40 pointer-events-none md:static md:z-auto md:pointer-events-auto md:w-full md:px-0 md:pb-4 md:order-first">
                <div className="max-w-sm md:max-w-full mx-auto pointer-events-auto">
                  <div className="relative flex items-center bg-white rounded-2xl border border-sandBeige/50 px-4 py-3 shadow-[0_4px_25px_rgba(0,0,0,0.12)] md:shadow-sm">
                    <span className="material-icons-outlined text-slate-400 text-lg mr-2 inline-flex items-center justify-center leading-none">search</span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="सदस्य खोजें (Search)..."
                      className="w-full bg-transparent border-none outline-none text-sm md:text-base text-slate-700 placeholder-slate-405 py-0 pt-[2px] leading-normal align-middle transform translate-y-[2.5px]"
                    />
                    <button
                      onClick={handleVoiceSearchToggle}
                      type="button"
                      className={`text-slate-400 hover:text-riverBlue flex items-center justify-center p-1.5 rounded-full hover:bg-slate-100 transition-colors ml-1 ${voiceActive ? 'text-softRed animate-pulse' : ''}`}
                      title="आवाज़ से खोजें (Voice Search)"
                    >
                      <span className="material-icons-outlined text-lg inline-flex items-center justify-center leading-none">mic</span>
                    </button>
                  </div>
                </div>
              </div>

            </section>
          )}

          {/* PAGE 3: REPORTS */}
          {currentActivePage === 'page-reports' && (
            <section className="page-view active animate-ripple pb-32 md:pb-6">
              
              {/* Filters */}
              <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4">
                <div>
                  <label className="block text-[10px] md:text-xs font-medium text-slate-600 mb-1">वर्ष (Year)</label>
                  <CustomDropdown
                    value={reportFilters.year}
                    onChange={(val) => setReportFilters(prev => ({ ...prev, year: val }))}
                    placeholder="सभी"
                    options={[
                      { value: 'all', label: 'सभी', icon: '📅' },
                      { value: '2024', label: '2024', icon: '📅' },
                      { value: '2025', label: '2025', icon: '📅' },
                      { value: '2026', label: '2026', icon: '📅' },
                      { value: '2027', label: '2027', icon: '📅' }
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-[10px] md:text-xs font-medium text-slate-600 mb-1">महीना (Month)</label>
                  <CustomDropdown
                    value={reportFilters.month}
                    onChange={(val) => setReportFilters(prev => ({ ...prev, month: val }))}
                    placeholder="सभी"
                    options={[
                      { value: 'all', label: 'सभी', icon: '🗓️' },
                      { value: '01', label: 'जनवरी', icon: '🗓️' },
                      { value: '02', label: 'फरवरी', icon: '🗓️' },
                      { value: '03', label: 'मार्च', icon: '🗓️' },
                      { value: '04', label: 'अप्रैल', icon: '🗓️' },
                      { value: '05', label: 'मई', icon: '🗓️' },
                      { value: '06', label: 'जून', icon: '🗓️' },
                      { value: '07', label: 'जुलाई', icon: '🗓️' },
                      { value: '08', label: 'अगस्त', icon: '🗓️' },
                      { value: '09', label: 'सितंबर', icon: '🗓️' },
                      { value: '10', label: 'अक्टूबर', icon: '🗓️' },
                      { value: '11', label: 'नवंबर', icon: '🗓️' },
                      { value: '12', label: 'दिसंबर', icon: '🗓️' }
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-[10px] md:text-xs font-medium text-slate-600 mb-1">प्रकार (Type)</label>
                  <CustomDropdown
                    value={reportFilters.type}
                    onChange={(val) => setReportFilters(prev => ({ ...prev, type: val }))}
                    placeholder="सभी"
                    options={[
                      { value: 'all', label: 'सभी', icon: '🔄' },
                      { value: 'income', label: 'आय (Income)', icon: '💰' },
                      { value: 'expense', label: 'खर्च (Expense)', icon: '💸' }
                    ]}
                  />
                </div>
              </div>

              {/* Report Summary Cards */}
              <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
                
                {/* Total Expense Filtered */}
                <div className="bg-gradient-to-br from-[#E53935] to-[#B71C1C] p-4 md:p-5 flex flex-col justify-between h-28 md:h-36 rounded-2xl shadow-sm border border-white/10 text-white hover:translate-y-[-3px] transition-transform">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider opacity-75 block font-semibold">EXPENSE • खर्च</span>
                    <span className="text-xs font-medium block mt-0.5">💸 कुल खर्च</span>
                  </div>
                  <div>
                    <div className="text-xl md:text-2xl font-bold tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                      ₹{reportSummaryData.expense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Current Balance Overall */}
                <div className="bg-gradient-to-br from-[#105E3D] via-[#1E7C53] to-[#0A3D26] p-4 md:p-5 flex flex-col justify-between h-28 md:h-36 rounded-2xl shadow-sm border border-white/10 text-white hover:translate-y-[-3px] transition-transform">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest opacity-80 block font-semibold">BALANCE • शेष राशि</span>
                    <span className="text-xs font-medium block mt-0.5">💰 कुल शेष राशि</span>
                  </div>
                  <div>
                    <div className="text-xl md:text-2xl font-bold tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                      ₹{reportSummaryData.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="col-span-2 text-center text-xs text-slate-500 font-medium bg-white py-2 px-4 rounded-xl border border-sandBeige/20 shadow-sm">
                  {reportSummaryData.periodText}
                </div>
              </div>

              {/* Transaction History */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-sandBeige/30 mb-6">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-lightGray">
                  <div className="flex flex-col">
                    <h3 class="text-sm font-medium text-slate-705 flex items-center gap-1.5">
                      <span className="material-icons-outlined text-riverBlue text-lg">history</span>
                      लेनदेन इतिहास (Transaction History)
                    </h3>
                    <span className="text-[10px] text-slate-500 font-medium mt-0.5">कुल प्रविष्टियां: {reportSummaryData.history.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePdfExport}
                      id="pdfExportBtn"
                      title="PDF डाउनलोड करें"
                      className="w-8 h-8 rounded-lg border border-riverBlue text-riverBlue hover:bg-riverBlue/5 flex items-center justify-center transition-all shadow-sm hover:translate-y-[-2px] hover:shadow-md"
                    >
                      <span className="material-icons-outlined text-base">picture_as_pdf</span>
                    </button>
                    <button
                      onClick={handleWhatsappShare}
                      id="whatsappShareBtn"
                      title="WhatsApp पर साझा करें"
                      className="w-8 h-8 rounded-lg bg-natureGreen text-white hover:bg-natureGreen/95 flex items-center justify-center transition-all shadow-sm hover:translate-y-[-2px] hover:shadow-md"
                    >
                      <span className="material-icons-outlined text-base">send</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[400px] md:max-h-[550px] overflow-y-auto pr-1">
                  {reportSummaryData.history.length === 0 ? (
                    <div className="text-center text-slate-450 py-8 text-xs">कोई प्रविष्टि नहीं मिली</div>
                  ) : (
                    reportSummaryData.history.map((item, idx) => {
                      const isContribution = item.item_type === 'contribution';
                      const title = isContribution ? item.name : item.paid_to;
                      const subtitle = isContribution
                        ? (item.type === 'cash' ? `💵 नकद दान` : `🏗️ सामग्री: ${item.item_name}`)
                        : `💸 खर्च`;
                      const details = isContribution
                        ? (item.type === 'cash' ? `भुगतान: ${item.payment_mode === 'upi' ? 'UPI' : item.payment_mode === 'bank' ? 'बैंक' : 'नकद'}` : `Qty: ${item.quantity} | Rate: ₹${item.rate}`)
                        : (item.description || 'विवरण नहीं है');
                      const amountStr = isContribution
                        ? (item.type === 'cash' ? `+₹${item.amount.toLocaleString('en-IN')}` : `+₹${item.total_value.toLocaleString('en-IN')}`)
                        : `-₹${item.amount.toLocaleString('en-IN')}`;

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border flex justify-between items-center transition-all hover:translate-x-[4px] hover:shadow-sm ${
                            isContribution 
                              ? 'bg-riverBlue/[0.015] border-riverBlue/10 hover:border-riverBlue/30' 
                              : 'bg-softRed/[0.015] border-softRed/10 hover:border-softRed/30'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-800 block truncate text-sm">
                              {isContribution ? `➕ ${title}` : `➖ ${title}`}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-0.5">
                              <span>{subtitle}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              <span>📅 {formatDateDisplay(item.date)}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-1 leading-normal italic">
                              {details} {item.remark ? `(${item.remark})` : ''}
                            </span>
                            {!isContribution && item.bill_image && (
                              <button
                                onClick={() => {
                                  setLightboxImgSrc(item.bill_image);
                                  setModals(prev => ({ ...prev, billLightbox: true }));
                                }}
                                className="mt-1 text-[11.5px] text-riverBlue flex items-center gap-1 hover:underline"
                              >
                                <span className="material-icons-outlined text-xs">image</span> रसीद देखें (View Bill)
                              </button>
                            )}
                          </div>
                          
                          <div className="text-right flex-shrink-0 ml-3">
                            <span className={`font-bold block text-sm ${isContribution ? 'text-riverBlue' : 'text-softRed'}`}>
                              {amountStr}
                            </span>
                            {currentUser && currentUser.is_admin === 1 && (
                              <div className="flex justify-end gap-1.5 mt-2">
                                <button
                                  onClick={() => isContribution ? openEditContribution(item) : openEditExpenseModal(item)}
                                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-205 text-slate-500 hover:text-riverBlue flex items-center justify-center transition-colors"
                                  title="संशोधित करें"
                                >
                                  <span className="material-icons-outlined text-sm">edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteEntry(item.id, isContribution ? 'contribution' : 'expense')}
                                  className="w-7 h-7 rounded-lg bg-softRed/10 hover:bg-softRed/20 text-softRed flex items-center justify-center transition-colors"
                                  title="हटाएं"
                                >
                                  <span className="material-icons-outlined text-sm">delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          )}

          {/* PAGE 5: SETTINGS */}
          {currentActivePage === 'page-settings' && (
            <section className="page-view active animate-ripple pb-32 md:pb-6">
              
              {/* HERO: Add New Member Card */}
              {currentUser && (
                <div className="bg-gradient-to-br from-riverBlue via-[#1a5fb0] to-[#0d3f7a] p-5 md:p-6 rounded-2xl shadow-lg border border-white/10 mb-5 text-white relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5"></div>
                  <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5"></div>
                  
                  <div className="relative z-10">
                    <h3 className="text-base md:text-lg font-semibold mb-4 flex items-center gap-2">
                      <span className="material-icons-outlined text-xl">person_add</span>
                      नया सदस्य जोड़ें (Add New Member)
                    </h3>
                    
                    <form onSubmit={handleAddMemberSubmit} className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-medium text-white/70 mb-1">नाम <span className="text-softRed font-semibold">*</span></label>
                          <input
                            type="text"
                            value={settingsMemberName}
                            onChange={(e) => setSettingsMemberName(e.target.value)}
                            required
                            placeholder="सदस्य का नाम दर्ज करें"
                            className="w-full bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2.5 text-sm md:text-base text-white placeholder-white/50 focus:ring-2 focus:ring-white/30 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-white/70 mb-1">मोबाइल नंबर <span className="text-softRed font-semibold">*</span></label>
                          <input
                            type="tel"
                            value={settingsMemberMobile}
                            onChange={(e) => setSettingsMemberMobile(e.target.value)}
                            required
                            maxLength={10}
                            placeholder="10 अंक का मोबाइल नंबर"
                            className="w-full bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2.5 text-sm md:text-base text-white placeholder-white/50 focus:ring-2 focus:ring-white/30 outline-none"
                          />
                        </div>
                      </div>
                      <button type="submit" className="w-full md:w-auto md:px-10 bg-white text-riverBlue rounded-xl py-2.5 text-xs font-bold hover:bg-white/90 transition-colors shadow-md mt-1">
                        <span className="flex items-center justify-center gap-2">
                          <span className="material-icons-outlined text-sm inline-flex items-center justify-center leading-none">group_add</span>
                          <span className="transform translate-y-[1.5px]">सदस्य जोड़ें (Add Member)</span>
                        </span>
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Settings Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                
                {/* Left Column: Profile Card & About App */}
                <div className="space-y-4">
                  
                  {/* Profile Details */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-sandBeige/30">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-lightGray flex items-center gap-2">
                      <span className="material-icons-outlined text-riverBlue">account_circle</span>
                      लॉगिन प्रोफ़ाइल (Login Profile)
                    </h3>
                    <div className="space-y-3">
                      {currentUser ? (
                        <>
                          {currentUser.is_admin === 1 ? (
                            <form onSubmit={handleAdminProfileUpdate} className="space-y-4">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-semibold text-slate-700">नाम (Name)</label>
                                <input
                                  type="text"
                                  id="profileNameInput"
                                  defaultValue={currentUser.name}
                                  required
                                  className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm md:text-base font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-semibold text-slate-700">मोबाइल (Mobile)</label>
                                <input
                                  type="tel"
                                  id="profileMobileInput"
                                  defaultValue={currentUser.mobile}
                                  required
                                  pattern="[0-9]{10}"
                                  className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm md:text-base font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                                />
                              </div>
                              <div className="flex justify-between items-center pt-3 border-t border-sandBeige/20">
                                <span className="text-sm text-slate-655 flex items-center">
                                  <span className="transform translate-y-[1.5px]">पद:&nbsp;</span>
                                  <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-riverBlue/10 text-riverBlue inline-flex items-center justify-center leading-none">
                                    <span className="transform translate-y-[1.5px]">एडमिन (Admin)</span>
                                  </span>
                                </span>
                                <button type="submit" className="bg-riverBlue text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-riverBlue/95 transition-colors shadow-sm flex items-center">
                                  <span className="transform translate-y-[1.5px]">अपडेट करें (Update)</span>
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex justify-between items-center border-b border-lightGray pb-3 pt-1">
                                <span className="text-sm font-semibold text-slate-600">नाम (Name):</span>
                                <span className="text-sm font-medium text-slate-800">{currentUser.name}</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-lightGray py-3">
                                <span className="text-sm font-semibold text-slate-600">मोबाइल (Mobile):</span>
                                <span className="text-sm font-medium text-slate-800">{currentUser.mobile}</span>
                              </div>
                              <div className="flex justify-between items-center pt-3">
                                <span className="text-sm font-semibold text-slate-600">पद (Role):</span>
                                <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-natureGreen/10 text-natureGreen">
                                  सामान्य सदस्य (Member)
                                </span>
                              </div>
                            </div>
                          )}
                          <div className="mt-4 pt-3 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={handleLogout}
                              className="w-full bg-softRed/10 text-softRed font-semibold py-2.5 rounded-xl text-center hover:bg-softRed/20 transition-colors flex items-center justify-center gap-2 shadow-sm"
                            >
                              <span className="material-icons-outlined text-sm inline-flex items-center justify-center leading-none">logout</span>
                              <span className="transform translate-y-[1.5px]">लॉगआउट करें (Logout)</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center text-slate-400 py-2 text-xs flex flex-col items-center gap-2">
                          <span>आप वर्तमान में लॉगिन नहीं हैं।</span>
                          <button onClick={() => setModals(prev => ({ ...prev, login: true }))} className="bg-riverBlue text-white px-4 py-1.5 rounded-xl text-xs font-medium">
                            लॉगिन करें
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* App Info */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-sandBeige/30">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-lightGray flex items-center gap-2">
                      <span className="material-icons-outlined text-riverBlue">info</span>
                      ऐप के बारे में (About App)
                    </h3>
                    <div className="space-y-3 text-xs text-slate-500 font-medium">
                      <div className="flex justify-between">
                        <span>वर्शन (Version):</span>
                        <span className="font-semibold text-slate-700">1.0.0 (React SPA)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>अंतिम अपडेट:</span>
                        <span className="font-semibold text-slate-700">21 जून 2026</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ऑफलाइन सपोर्ट status:</span>
                        <span className="font-semibold text-natureGreen">सक्रिय (Service Worker)</span>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex justify-between gap-4">
                        <button
                          onClick={handleClearCache}
                          id="clearCacheBtn"
                          className="w-full bg-softRed/10 text-softRed font-semibold py-2 rounded-xl text-center hover:bg-softRed/20 transition-colors"
                        >
                          कैश साफ़ करें (Clear Cache)
                        </button>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Right Column: Admin Panel Controls & PIN Change */}
                <div className="space-y-4">
                  
                  {/* Admin Lock system controls */}
                  {currentUser && currentUser.is_admin === 1 && (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-sandBeige/30">
                      <h3 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-lightGray flex items-center gap-2">
                        <span className="material-icons-outlined text-riverBlue">lock</span>
                        एडमिन पैनल नियंत्रण (Admin Lock Control)
                      </h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-slate-700 block">प्रविष्टि लॉक करें</span>
                          <span className="text-[11px] text-slate-400 font-medium">योगदान जोड़ने पर प्रतिबंध लगाएं।</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={appData.edit_locked}
                            onChange={(e) => handleToggleSystemEditMode(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-riverBlue"></div>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* PIN Change */}
                  {currentUser && (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-sandBeige/30">
                      <h3 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-lightGray flex items-center gap-2">
                        <span className="material-icons-outlined text-riverBlue">lock_reset</span>
                        पिन बदलें (Change PIN)
                      </h3>
                      <form onSubmit={handleChangePinSubmit} className="space-y-3.5">
                        
                        <div className="flex flex-col gap-1.5 relative">
                          <label className="text-xs font-semibold text-slate-600">पुराना PIN</label>
                          <input
                            type={showOldPin ? 'text' : 'password'}
                            value={oldPinInput}
                            onChange={(e) => setOldPinInput(e.target.value)}
                            required
                            placeholder="पुराना PIN दर्ज करें"
                            className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowOldPin(!showOldPin)}
                            className="absolute right-3 top-[32px] text-slate-400 hover:text-slate-650"
                          >
                            <span className="material-icons-outlined text-lg">
                              {showOldPin ? 'visibility' : 'visibility_off'}
                            </span>
                          </button>
                        </div>

                        <div className="flex flex-col gap-1.5 relative">
                          <label className="text-xs font-semibold text-slate-600">नया PIN</label>
                          <input
                            type={showNewPin ? 'text' : 'password'}
                            value={newPinInput}
                            onChange={(e) => setNewPinInput(e.target.value)}
                            required
                            placeholder="नया PIN दर्ज करें"
                            className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPin(!showNewPin)}
                            className="absolute right-3 top-[32px] text-slate-400 hover:text-slate-650"
                          >
                            <span className="material-icons-outlined text-lg">
                              {showNewPin ? 'visibility' : 'visibility_off'}
                            </span>
                          </button>
                        </div>

                        <div className="flex flex-col gap-1.5 relative">
                          <label className="text-xs font-semibold text-slate-600">नया PIN पुष्टि करें</label>
                          <input
                            type={showConfirmPin ? 'text' : 'password'}
                            value={confirmPinInput}
                            onChange={(e) => setConfirmPinInput(e.target.value)}
                            required
                            placeholder="पुष्टि PIN दर्ज करें"
                            className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPin(!showConfirmPin)}
                            className="absolute right-3 top-[32px] text-slate-400 hover:text-slate-650"
                          >
                            <span className="material-icons-outlined text-lg">
                              {showConfirmPin ? 'visibility' : 'visibility_off'}
                            </span>
                          </button>
                        </div>

                        <button
                          type="submit"
                          disabled={pinChangeLoading}
                          className="w-full bg-riverBlue text-white rounded-xl py-2.5 text-xs font-semibold hover:bg-riverBlue/95 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                        >
                          {pinChangeLoading ? (
                            <>
                              <span className="material-icons-outlined text-sm animate-spin">sync</span>
                              <span>कृपया प्रतीक्षा करें...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-icons-outlined text-sm">lock_reset</span>
                              <span>PIN बदलें</span>
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  )}

                </div>
              </div>

            </section>
          )}

        </main>

        {/* Mobile Navigation bar */}
        <div className="fixed bottom-4 left-4 right-4 z-40 pointer-events-none md:hidden">
          <nav className="max-w-sm mx-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-sandBeige/20 py-2.5 px-2 pointer-events-auto">
            <div className={`grid ${currentUser ? 'grid-cols-4' : 'grid-cols-3'} text-center`}>
              <button
                onClick={() => setCurrentActivePage('page-dashboard')}
                className={`nav-item flex flex-col items-center justify-center transition-all ${currentActivePage === 'page-dashboard' ? 'text-riverBlue' : 'text-slate-400'}`}
              >
                <span className="material-icons-outlined text-[28px]">home</span>
                <span className="text-[13px] font-semibold mt-1">डैशबोर्ड</span>
              </button>
              <button
                onClick={() => setCurrentActivePage('page-members')}
                className={`nav-item flex flex-col items-center justify-center transition-all ${currentActivePage === 'page-members' ? 'text-riverBlue' : 'text-slate-400'}`}
              >
                <span className="material-icons-outlined text-[28px]">people</span>
                <span className="text-[13px] font-semibold mt-1">सदस्य</span>
              </button>
              <button
                onClick={() => setCurrentActivePage('page-reports')}
                className={`nav-item flex flex-col items-center justify-center transition-all ${currentActivePage === 'page-reports' ? 'text-riverBlue' : 'text-slate-400'}`}
              >
                <span className="material-icons-outlined text-[28px]">bar_chart</span>
                <span className="text-[13px] font-semibold mt-1">रिपोर्ट</span>
              </button>
              {currentUser && (
                <button
                  onClick={() => setCurrentActivePage('page-settings')}
                  className={`nav-item flex flex-col items-center justify-center transition-all ${currentActivePage === 'page-settings' ? 'text-riverBlue' : 'text-slate-400'}`}
                >
                  <span className="material-icons-outlined text-[28px]">settings</span>
                  <span className="text-[13px] font-semibold mt-1">सेटिंग्स</span>
                </button>
              )}
            </div>
          </nav>
        </div>

      </div>

      {/* ================= MODALS ================= */}

      {/* 1. Login Modal */}
      {modals.login && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl animate-ripple relative">
            <button
              onClick={() => setModals(prev => ({ ...prev, login: false }))}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-650"
            >
              <span className="material-icons-outlined">close</span>
            </button>
            <h3 className="text-md text-riverBlue font-medium mb-4 pb-2 border-b border-lightGray">
              🔑 लॉगिन करें (Member Login)
            </h3>
            
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">मोबाइल नंबर (Mobile Number)</label>
                <input
                  type="tel"
                  value={loginMobile}
                  onChange={(e) => setLoginMobile(e.target.value)}
                  required
                  maxLength={10}
                  placeholder="10 अंकों का मोबाइल"
                  className="w-full bg-lightGray border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-riverBlue/30 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">पासवर्ड / पिन (Password)</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  placeholder="पिन या मोबाइल के अंतिम 4 अंक"
                  className="w-full bg-lightGray border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-riverBlue/30 outline-none"
                />
              </div>
              <div className="text-[10px] text-slate-400">
                *सामान्य सदस्यों के लिए पासवर्ड उनके मोबाइल नंबर के आखिरी 4 अंक हैं।
              </div>
              <button type="submit" className="w-full bg-riverBlue text-white rounded-xl py-3 text-sm font-medium hover:bg-riverBlue/90 transition-colors shadow-sm flex items-center justify-center">
                <span className="transform translate-y-[1.5px]">लॉगिन करें</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Contribution Modal */}
      {modals.addContribution && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto animate-ripple relative">
            <button
              onClick={() => {
                setModals(prev => ({ ...prev, addContribution: false }));
                setAddContName('');
                setAddContMobile('');
                setGeneralAddContMemberMobile('');
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-650"
            >
              <span className="material-icons-outlined">close</span>
            </button>
            <h3 className="text-md text-riverBlue font-medium mb-4 pb-2 border-b border-lightGray">
              ✍️ नया योगदान (Contribution) जोड़ें
            </h3>
            
            <form onSubmit={handleAddContributionSubmit} className="space-y-4">
              
              {/* If Name is empty (implies general add mode, show dropdown) */}
              {!addContName ? (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">सदस्य चुनें <span className="text-softRed font-semibold">*</span></label>
                  <CustomDropdown
                    value={generalAddContMemberMobile}
                    onChange={(val) => {
                      setGeneralAddContMemberMobile(val);
                      const m = appData.members.find(memb => memb.mobile === val);
                      if (m) {
                        setAddContName(m.name);
                        setAddContMobile(m.mobile || '');
                      }
                    }}
                    placeholder="👥 सदस्य चुनें"
                    options={appData.members.map(m => ({
                      value: m.mobile,
                      label: `👤 ${m.name}`,
                      rightText: `📞 ${m.mobile}`
                    }))}
                  />
                </div>
              ) : (
                <div className="space-y-3 bg-lightGray/40 p-3 rounded-xl border border-sandBeige/20">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-semibold">नाम:</span>
                    <span className="text-slate-800 font-bold">{addContName}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-semibold">मोबाइल:</span>
                    <span className="text-slate-800 font-bold">{addContMobile}</span>
                  </div>
                </div>
              )}

              {/* Contribution Type */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">योगदान का प्रकार <span className="text-softRed font-semibold">*</span></label>
                <CustomDropdown
                  value={addContType}
                  onChange={(val) => setAddContType(val)}
                  options={[
                    { value: 'cash', label: 'नकद (Cash)', icon: '💰' },
                    { value: 'goods', label: 'सामग्री (Goods)', icon: '🏗️' }
                  ]}
                />
              </div>

              {/* Date */}
              <CustomCalendar
                value={addContDate}
                onChange={(val) => setAddContDate(val)}
                label="तारीख"
                required={true}
              />

              {/* Remark */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">विवरण (Remark)</label>
                <input
                  type="text"
                  value={addContRemark}
                  onChange={(e) => setAddContRemark(e.target.value)}
                  placeholder="जैसे: घाट निर्माण के लिए"
                  className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                />
              </div>

              {/* Conditional Cash Section */}
              {addContType === 'cash' ? (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">दान राशि (₹) <span className="text-softRed font-semibold">*</span></label>
                    <input
                      type="number"
                      value={addCashAmount}
                      onChange={(e) => setAddCashAmount(e.target.value)}
                      placeholder="राशि दर्ज करें"
                      required
                      className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">भुगतान का माध्यम <span className="text-softRed font-semibold">*</span></label>
                    <CustomDropdown
                      value={addPaymentMode}
                      onChange={(val) => setAddPaymentMode(val)}
                      options={[
                        { value: 'cash', label: '💵 नकद (Cash)' },
                        { value: 'upi', label: '📱 UPI (PhonePe / GPay)' },
                        { value: 'bank', label: '🏦 बैंक ट्रांसफर' }
                      ]}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">सामग्री का नाम <span className="text-softRed font-semibold">*</span></label>
                    <input
                      type="text"
                      value={addGoodsItemName}
                      onChange={(e) => setAddGoodsItemName(e.target.value)}
                      placeholder="जैसे: ईंट, सीमेंट, रेत"
                      required
                      className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">मात्रा (Qty) <span className="text-softRed font-semibold">*</span></label>
                      <input
                        type="number"
                        value={addGoodsQty}
                        onChange={(e) => setAddGoodsQty(e.target.value)}
                        placeholder="0"
                        required
                        className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">दर (Rate per Qty) <span className="text-softRed font-semibold">*</span></label>
                      <input
                        type="number"
                        value={addGoodsRate}
                        onChange={(e) => setAddGoodsRate(e.target.value)}
                        placeholder="₹ 0"
                        required
                        className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">स्वचालित कुल मूल्य (Auto Total Value)</label>
                    <div className="w-full bg-lightGray/70 border border-sandBeige/30 rounded-xl px-4 py-3 text-sm text-slate-500 font-bold">
                      ₹ {addGoodsAutoTotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              )}

              <button type="submit" className="w-full bg-riverBlue text-white rounded-xl py-3.5 text-sm font-semibold hover:bg-riverBlue/95 transition-colors shadow-md mt-2 flex items-center justify-center">
                <span className="transform translate-y-[1.5px]">योगदान जोड़ें (Add Contribution)</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Edit Contribution Modal */}
      {modals.editContribution && selectedContribution && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto animate-ripple relative">
            <button
              onClick={() => {
                setModals(prev => ({ ...prev, editContribution: false }));
                setSelectedContribution(null);
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-650"
            >
              <span className="material-icons-outlined">close</span>
            </button>
            <h3 className="text-md text-riverBlue font-medium mb-4 pb-2 border-b border-lightGray">
              ✏️ योगदान संशोधित करें (Edit Contribution)
            </h3>
            
            <form onSubmit={handleEditContributionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">नाम <span className="text-softRed font-semibold">*</span></label>
                <input
                  type="text"
                  value={editContName}
                  onChange={(e) => setEditContName(e.target.value)}
                  required
                  className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">मोबाइल नंबर</label>
                <input
                  type="tel"
                  value={editContMobile}
                  onChange={(e) => setEditContMobile(e.target.value)}
                  className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">योगदान का प्रकार <span className="text-softRed font-semibold">*</span></label>
                <CustomDropdown
                  value={editContType}
                  onChange={(val) => setEditContType(val)}
                  options={[
                    { value: 'cash', label: 'नकद (Cash)', icon: '💰' },
                    { value: 'goods', label: 'सामग्री (Goods)', icon: '🏗️' }
                  ]}
                />
              </div>

              <CustomCalendar
                value={editContDate}
                onChange={(val) => setEditContDate(val)}
                label="तारीख"
                required={true}
              />

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">विवरण (Remark)</label>
                <input
                  type="text"
                  value={editContRemark}
                  onChange={(e) => setEditContRemark(e.target.value)}
                  className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                />
              </div>

              {editContType === 'cash' ? (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">दान राशि (₹) <span className="text-softRed font-semibold">*</span></label>
                    <input
                      type="number"
                      value={editCashAmount}
                      onChange={(e) => setEditCashAmount(e.target.value)}
                      placeholder="राशि दर्ज करें"
                      required
                      className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">भुगतान का माध्यम <span className="text-softRed font-semibold">*</span></label>
                    <CustomDropdown
                      value={editPaymentMode}
                      onChange={(val) => setEditPaymentMode(val)}
                      options={[
                        { value: 'cash', label: '💵 नकद (Cash)' },
                        { value: 'upi', label: '📱 UPI (PhonePe / GPay)' },
                        { value: 'bank', label: '🏦 बैंक ट्रांसफर' }
                      ]}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">सामग्री का नाम <span className="text-softRed font-semibold">*</span></label>
                    <input
                      type="text"
                      value={editGoodsItemName}
                      onChange={(e) => setEditGoodsItemName(e.target.value)}
                      placeholder="सामग्री नाम"
                      required
                      className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">मात्रा (Qty) <span className="text-softRed font-semibold">*</span></label>
                      <input
                        type="number"
                        value={editGoodsQty}
                        onChange={(e) => setEditGoodsQty(e.target.value)}
                        required
                        className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">दर (Rate per Qty) <span className="text-softRed font-semibold">*</span></label>
                      <input
                        type="number"
                        value={editGoodsRate}
                        onChange={(e) => setEditGoodsRate(e.target.value)}
                        required
                        className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">स्वचालित कुल मूल्य</label>
                    <div className="w-full bg-lightGray/70 border border-sandBeige/30 rounded-xl px-4 py-3 text-sm text-slate-500 font-bold">
                      ₹ {editGoodsAutoTotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              )}

              <button type="submit" className="w-full bg-riverBlue text-white rounded-xl py-3.5 text-sm font-semibold hover:bg-riverBlue/95 transition-colors shadow-md mt-2 flex items-center justify-center">
                <span className="transform translate-y-[1.5px]">अपडेट सुरक्षित करें</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Expense Modal (Add / Edit) */}
      {modals.expense && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto animate-ripple relative">
            <button
              onClick={() => {
                setModals(prev => ({ ...prev, expense: false }));
                setSelectedExpense(null);
                setBase64BillImage('');
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-655"
            >
              <span className="material-icons-outlined">close</span>
            </button>
            <h3 className="text-md text-riverBlue font-medium mb-4 pb-2 border-b border-lightGray">
              {selectedExpense ? '💸 खर्च संशोधित करें (Edit Expense)' : '💸 नया खर्च (Expense) दर्ज करें'}
            </h3>
            
            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">राशि (₹) <span className="text-softRed font-semibold">*</span></label>
                <input
                  type="number"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="खर्च राशि"
                  required
                  className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-655 mb-1">भुगतान पाने वाले का नाम (Paid To) <span className="text-softRed font-semibold">*</span></label>
                <input
                  type="text"
                  value={expPaidTo}
                  onChange={(e) => setExpPaidTo(e.target.value)}
                  placeholder="जैसे: दुकानदार का नाम"
                  required
                  className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                />
              </div>

              <CustomCalendar
                value={expDate}
                onChange={(val) => setExpDate(val)}
                label="तारीख"
                required={true}
              />

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">खर्च का विवरण (Description)</label>
                <textarea
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="विवरण दर्ज करें"
                  rows={2}
                  className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none resize-none"
                />
              </div>

              {/* Bill Image Upload Container */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">रसीद / बिल की फोटो (Bill Image)</label>
                <div className="flex items-center gap-3">
                  <label className="flex-grow bg-lightGray hover:bg-slate-105 border border-dashed border-sandBeige rounded-xl py-3 px-4 flex items-center justify-center gap-2 cursor-pointer transition-colors text-xs font-semibold text-slate-600">
                    <span className="material-icons-outlined text-riverBlue text-base">cloud_upload</span>
                    <span id="billFileName">
                      {base64BillImage === 'loading'
                        ? 'कंप्रेस किया जा रहा है...'
                        : base64BillImage 
                        ? 'फ़ाइल अपलोड की गई' 
                        : selectedExpense && selectedExpense.bill_image && keepExistingImage
                        ? 'मौजूदा रसीद'
                        : 'फोटो अपलोड करें'
                      }
                    </span>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleBillImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </label>
                  
                  {/* Clear Image Button */}
                  {((base64BillImage && base64BillImage !== 'loading') || (selectedExpense && selectedExpense.bill_image && keepExistingImage)) && (
                    <button
                      type="button"
                      onClick={() => {
                        setBase64BillImage('');
                        setKeepExistingImage(false);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="bg-softRed/10 text-softRed p-3 rounded-xl flex items-center justify-center hover:bg-softRed/20 transition-colors"
                    >
                      <span className="material-icons-outlined text-base">delete</span>
                    </button>
                  )}
                </div>
              </div>

              <button type="submit" className="w-full bg-riverBlue text-white rounded-xl py-3.5 text-sm font-semibold hover:bg-riverBlue/95 transition-colors shadow-md mt-2 flex items-center justify-center">
                <span className="transform translate-y-[1.5px]">{selectedExpense ? 'अपडेट सुरक्षित करें' : 'खर्च सुरक्षित करें'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {modals.addMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto animate-ripple relative">
            <button
              onClick={() => {
                setModals(prev => ({ ...prev, addMember: false }));
                setSettingsMemberName('');
                setSettingsMemberMobile('');
                setRecentlyAddedMember(null);
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-650"
            >
              <span className="material-icons-outlined">close</span>
            </button>
            
            <h3 className="text-md text-riverBlue font-medium mb-4 pb-2 border-b border-lightGray flex items-center gap-1.5">
              <span className="material-icons-outlined text-riverBlue text-lg">person_add</span>
              नया सदस्य जोड़ें (Add New Member)
            </h3>

            {recentlyAddedMember && (
              <div className="bg-natureGreen/5 border border-natureGreen/30 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5 mb-4 animate-ripple">
                <div className="font-bold text-natureGreen flex items-center gap-1 text-sm">
                  <span className="material-icons-outlined text-sm">check_circle</span>
                  सफलतापूर्वक जोड़ा गया! (Successfully Added)
                </div>
                <div><span className="font-semibold text-slate-600">नाम (Name):</span> {recentlyAddedMember.name}</div>
                <div><span className="font-semibold text-slate-600">मोबाइल (Mobile):</span> {recentlyAddedMember.mobile}</div>
                <div><span className="font-semibold text-slate-600">लॉगिन पासवर्ड (PIN):</span> <span className="font-bold text-riverBlue bg-riverBlue/5 px-2 py-0.5 rounded ml-1">{recentlyAddedMember.pin}</span></div>
              </div>
            )}
            
            <form onSubmit={handleAddMemberSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">नाम (Name) <span className="text-softRed font-semibold">*</span></label>
                <input
                  type="text"
                  value={settingsMemberName}
                  onChange={(e) => setSettingsMemberName(e.target.value)}
                  required
                  placeholder="सदस्य का नाम दर्ज करें"
                  className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">मोबाइल नंबर (Mobile) <span className="text-softRed font-semibold">*</span></label>
                <input
                  type="tel"
                  value={settingsMemberMobile}
                  onChange={(e) => setSettingsMemberMobile(e.target.value)}
                  required
                  maxLength={10}
                  placeholder="10 अंक का मोबाइल नंबर"
                  className="w-full border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none"
                />
              </div>

              <button type="submit" className="w-full bg-riverBlue text-white rounded-xl py-3.5 text-sm font-semibold hover:bg-riverBlue/95 transition-colors shadow-md mt-2 flex items-center justify-center">
                <span className="transform translate-y-[1.5px]">सदस्य जोड़ें (Add Member)</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. Member Detail Modal */}
      {modals.memberDetail && selectedMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto animate-ripple relative">
            <button
              onClick={() => {
                setModals(prev => ({ ...prev, memberDetail: false }));
                setSelectedMember(null);
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-655"
            >
              <span className="material-icons-outlined">close</span>
            </button>
            
            <h3 className="text-[17px] text-riverBlue font-semibold mb-4 pb-2 border-b border-lightGray flex items-center gap-1.5">
              👤 {selectedMember.name} ({selectedMember.is_admin ? 'एडमिन' : 'सदस्य'})
            </h3>

            {/* Total Summaries */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-riverBlue/5 p-3.5 rounded-xl border border-riverBlue/10">
                <span className="text-[10px] font-semibold text-slate-600 block">💵 कुल नकद दान</span>
                <span className="text-base font-bold text-riverBlue">₹ {(Number(selectedMember.cash_total) || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-natureGreen/5 p-3.5 rounded-xl border border-natureGreen/10">
                <span className="text-[10px] font-semibold text-slate-600 block">🏗️ कुल सामग्री मूल्य</span>
                <span className="text-base font-bold text-natureGreen">₹ {(Number(selectedMember.goods_total) || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Admin Controls inside Detail Modal */}
            {currentUser && currentUser.is_admin === 1 && (
              <div className="mb-4 p-4 bg-lightGray rounded-xl border border-sandBeige/30 animate-ripple">
                <form onSubmit={handleAdminUpdateMemberSubmit} className="space-y-4">
                  <h5 className="text-xs font-semibold text-riverBlue flex items-center gap-1.5 border-b border-sandBeige/20 pb-1.5 uppercase tracking-wider">
                    <span className="material-icons-outlined text-base">manage_accounts</span>
                    एडमिन नियंत्रण (Admin Controls)
                  </h5>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-600">सदस्य का नाम (Name)</label>
                    <input
                      type="text"
                      value={mDetEditName}
                      onChange={(e) => setMDetEditName(e.target.value)}
                      className="w-full border border-sandBeige/70 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none bg-white"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-600">मोबाइल नंबर (Mobile)</label>
                    <input
                      type="tel"
                      value={mDetEditMobile}
                      onChange={(e) => setMDetEditMobile(e.target.value)}
                      pattern="[0-9]{10}"
                      className="w-full border border-sandBeige/70 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-riverBlue/30 outline-none bg-white"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-sandBeige/20 pt-3">
                    <div>
                      <span className="text-xs font-semibold text-slate-700 block">लॉगिन अनुमति</span>
                      <span className="text-[10px] text-slate-450 block">लॉगिन सुविधा चालू/बंद करें।</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMember.status === 1}
                        disabled={selectedMember.id === currentUser.id}
                        onChange={(e) => handleToggleMemberAccess(selectedMember.id, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-riverBlue"></div>
                    </label>
                  </div>
                  
                  <div className="flex justify-end pt-2 border-t border-sandBeige/20">
                    <button type="submit" className="bg-riverBlue text-white rounded-xl px-4 py-2 text-xs font-semibold hover:bg-riverBlue/95 transition-colors shadow-sm w-full flex items-center justify-center">
                      <span className="transform translate-y-[1.5px]">विवरण सहेजें (Save Info)</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* History List */}
            <h4 className="text-xs font-bold text-slate-700 mb-2.5 uppercase tracking-wider">📜 योगदान इतिहास (Contribution History)</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {selectedMemberHistory.length === 0 ? (
                <div className="text-center text-slate-400 py-4 text-xs">कोई योगदान इतिहास नहीं मिला</div>
              ) : (
                selectedMemberHistory.map((c) => (
                  <div key={c.id} className="flex justify-between items-center text-xs p-2.5 bg-lightGray rounded-xl border border-sandBeige/10">
                    <div>
                      <span className="font-semibold text-slate-750 block">
                        {c.type === 'cash' ? `💵 नकद दान` : `🏗️ सामग्री: ${c.item_name}`}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        📅 {formatDateDisplay(c.date)} {c.remark ? `| ${c.remark}` : ''}
                      </span>
                    </div>
                    <span className={`font-bold ${c.type === 'cash' ? 'text-riverBlue' : 'text-natureGreen'}`}>
                      {c.type === 'cash' ? `+₹${c.amount.toLocaleString('en-IN')}` : `+₹${c.total_value.toLocaleString('en-IN')}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Bill Image Lightbox Modal */}
      {modals.billLightbox && lightboxImgSrc && (
        <div 
          onClick={() => {
            setModals(prev => ({ ...prev, billLightbox: false }));
            setLightboxImgSrc('');
          }}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <img 
            className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain animate-ripple" 
            src={lightboxImgSrc} 
            alt="Bill Image" 
          />
        </div>
      )}

      {/* ================= CUSTOM ALERT POPUP MODAL ================= */}
      {customAlert.show && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl text-center border border-sandBeige/25 transform scale-100 opacity-100 transition-all duration-300">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 border shadow-sm ${
              customAlert.type === 'success' ? 'bg-[#E8F5E9] border-[#A5D6A7]' :
              customAlert.type === 'error' ? 'bg-[#FFEBEE] border-[#FFCDD2]' : 'bg-[#E3F2FD] border-[#90CAF9]'
            }`}>
              {customAlert.type === 'success' && <span className="material-icons-outlined text-3xl text-natureGreen">check_circle</span>}
              {customAlert.type === 'error' && <span className="material-icons-outlined text-3xl text-softRed">error_outline</span>}
              {customAlert.type === 'info' && <span className="material-icons-outlined text-3xl text-riverBlue">info</span>}
            </div>
            
            <h3 className="text-base font-semibold text-slate-800 mb-1.5">{customAlert.title}</h3>
            <p className="text-[12.5px] text-slate-500 mb-5 leading-relaxed">{customAlert.message}</p>
            
            <button
              onClick={() => {
                setCustomAlert(prev => ({ ...prev, show: false }));
                if (customAlert.callback) customAlert.callback();
              }}
              className={`w-full text-white rounded-xl py-2.5 text-xs font-semibold transition-all shadow-md focus:outline-none ${
                customAlert.type === 'success' ? 'bg-[#2E7D32] hover:bg-[#2E7D32]/90' :
                customAlert.type === 'error' ? 'bg-[#E53935] hover:bg-[#E53935]/90' : 'bg-[#1E5AA8] hover:bg-[#1E5AA8]/90'
              }`}
            >
              ठीक है (OK)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// Sub-component: Splash Screen
function SplashScreen() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  if (!showSplash) return null;

  return (
    <div className="fixed inset-0 bg-[#F5E6C8] z-[999] flex flex-col items-center justify-center transition-all duration-700 ease-out">
      <div className="text-center flex flex-col items-center px-6">
        <div className="relative w-32 h-32 mb-6 flex items-center justify-center">
          <img src="logo.png" alt="Logo" className="w-full h-full object-contain rounded-full border border-sandBeige shadow-[0_8px_30px_rgba(0,0,0,0.12)]" />
        </div>
        <h1 className="text-3xl text-riverBlue font-medium tracking-wide">प्रजापति एकता ग्रुप</h1>
        <p className="text-sm text-natureGreen font-medium mt-2">“एकता में शक्ति, सेवा में समर्पण”</p>
        <div className="mt-8 flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-riverBlue animate-bounce" style={{ animationDelay: '0.1s' }}></span>
          <span className="w-2 h-2 rounded-full bg-riverBlue animate-bounce" style={{ animationDelay: '0.2s' }}></span>
          <span className="w-2 h-2 rounded-full bg-riverBlue animate-bounce" style={{ animationDelay: '0.3s' }}></span>
        </div>
      </div>
    </div>
  );
}
