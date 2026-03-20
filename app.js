// ═══════════════════════════════════════════
//  JS Constructions - יומן עבודה
//  Firebase Firestore + Vanilla JS
// ═══════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ─── הגדרות Firebase (הכנס את הערכים שלך) ───
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ─── קבועים ───
const CODES = { EMPLOYEE: "1234", ADMIN: "14994" };
const HEADERS = [
  "יום בשבוע","תאריך","שם עובד","סוג שכר","שם פרויקט",
  "שעת כניסה","שעת יציאה","שעות עבודה","משיכות","למי המשיכה",
  "אוכל","חניה","דלק","עלות לינה","שם משלם","תעריף יומי",
  "עלות מחושבת","התחשבות עלות לבעל פרויקט","הערות",
];

// ─── מצב גלובלי ───
let state = {
  role: null,           // 'employee' | 'admin'
  employeeName: null,
  checkIn: null,
  checkOut: null,
  allEntries: [],
  employees: [],
  projects: [],
  editingEntryId: null,
  filterMode: "all",
};

// ═══════════════════════════════════════════
//  ניווט בין מסכים
// ═══════════════════════════════════════════
function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}
window.showView = showView;

// ═══════════════════════════════════════════
//  כניסה
// ═══════════════════════════════════════════
window.doLogin = function () {
  const code = document.getElementById("login-code").value.trim();
  const errEl = document.getElementById("login-error");
  errEl.classList.add("hidden");

  if (code === CODES.ADMIN) {
    state.role = "admin";
    initManager();
    showView("view-manager");
  } else if (code === CODES.EMPLOYEE) {
    state.role = "employee";
    showEmployeeSelect();
  } else {
    errEl.textContent = "קוד לא נכון";
    errEl.classList.remove("hidden");
  }
};

window.logout = function () {
  state = { role: null, employeeName: null, checkIn: null, checkOut: null,
            allEntries: [], employees: [], projects: [], editingEntryId: null, filterMode: "all" };
  document.getElementById("login-code").value = "";
  showView("view-login");
};

// Allow pressing Enter on login
document.getElementById("login-code").addEventListener("keydown", e => {
  if (e.key === "Enter") doLogin();
});

// ═══════════════════════════════════════════
//  בחירת עובד
// ═══════════════════════════════════════════
async function showEmployeeSelect() {
  state.employees = await loadEmployees();
  const list = document.getElementById("employee-list");
  list.innerHTML = "";
  const names = state.employees.length > 0
    ? state.employees.map(e => e.name)
    : ["ELIAS", "KRES", "FAHIM"];

  names.forEach(name => {
    const btn = document.createElement("button");
    btn.className = "employee-btn";
    btn.textContent = name;
    btn.onclick = () => initEmployee(name);
    list.appendChild(btn);
  });
  showView("view-select");
}

// ═══════════════════════════════════════════
//  מסך עובד
// ═══════════════════════════════════════════
async function initEmployee(name) {
  state.employeeName = name;
  state.checkIn = null;
  state.checkOut = null;
  state.projects = await loadProjects();

  document.getElementById("emp-name-header").textContent = name;
  document.getElementById("emp-day").textContent   = "יום " + getDayHebrew();
  document.getElementById("emp-date").textContent  = getDateStr();
  document.getElementById("checkin-time").textContent  = "לחץ לרישום";
  document.getElementById("checkout-time").textContent = "לחץ לרישום";
  document.getElementById("btn-checkin").classList.remove("stamped");
  document.getElementById("btn-checkout").classList.remove("stamped");
  document.getElementById("emp-notes").value = "";
  document.getElementById("emp-success").classList.add("hidden");

  const sel = document.getElementById("emp-project");
  sel.innerHTML = '<option value="">בחר פרויקט...</option>';
  state.projects.forEach(p => {
    const o = document.createElement("option");
    o.value = p.name; o.textContent = p.name;
    sel.appendChild(o);
  });

  showView("view-employee");
}

window.checkIn = function () {
  if (state.checkIn) return;
  state.checkIn = getNowTime();
  document.getElementById("checkin-time").textContent = state.checkIn;
  document.getElementById("btn-checkin").classList.add("stamped");
};

window.checkOut = function () {
  if (!state.checkIn) { alert("יש לרשום כניסה תחילה"); return; }
  if (state.checkOut) return;
  state.checkOut = getNowTime();
  document.getElementById("checkout-time").textContent = state.checkOut;
  document.getElementById("btn-checkout").classList.add("stamped");
};

window.saveEmployeeEntry = async function () {
  const project = document.getElementById("emp-project").value;
  const notes   = document.getElementById("emp-notes").value.trim();
  if (!state.checkIn) { alert("יש לרשום שעת כניסה"); return; }
  if (!project)       { alert("יש לבחור פרויקט");    return; }

  const empData = state.employees.find(e => e.name === state.employeeName) || {};
  const entry = {
    employeeName:  state.employeeName,
    project,
    date:          getDateStr(),
    dayOfWeek:     getDayHebrew(),
    checkIn:       state.checkIn,
    checkOut:      state.checkOut || "",
    notes,
    salaryType:    empData.salaryType || "",
    payer:         empData.payer      || "",
    dailyRate:     empData.dailyRate  || 0,
    isComplete:    false,
    createdAt:     Date.now(),
    // שדות מנהל
    hoursWorked: 0, withdrawals: 0, withdrawalFor: "",
    food: 0, parking: 0, fuel: 0, accommodation: 0,
    calculatedCost: 0, projectOwnerCost: 0,
  };

  await addDoc(collection(db, "entries"), entry);
  document.getElementById("emp-success").classList.remove("hidden");
  setTimeout(() => logout(), 2000);
};

// ═══════════════════════════════════════════
//  מסך מנהל
// ═══════════════════════════════════════════
async function initManager() {
  state.employees = await loadEmployees();
  state.projects  = await loadProjects();
  listenEntries();
}

function listenEntries() {
  const q = query(collection(db, "entries"), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    state.allEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEntries();
  });
}

function renderEntries() {
  const list = document.getElementById("entries-list");
  let entries = [...state.allEntries];

  if (state.filterMode === "pending")  entries = entries.filter(e => !e.isComplete);
  if (state.filterMode === "complete") entries = entries.filter(e =>  e.isComplete);

  if (entries.length === 0) {
    list.innerHTML = '<div class="empty-state">📋 אין רשומות</div>';
    return;
  }

  list.innerHTML = entries.map(e => `
    <div class="entry-card ${e.isComplete ? 'complete' : ''}" onclick="openEditEntry('${e.id}')">
      <div class="entry-header">
        <span class="entry-name">${e.employeeName} | ${e.project}</span>
        <span class="entry-status ${e.isComplete ? 'status-complete' : 'status-pending'}">
          ${e.isComplete ? "✅ הושלם" : "⏳ ממתין"}
        </span>
      </div>
      <div class="entry-details">
        📅 ${e.dayOfWeek} ${e.date}
        ${e.checkIn ? ` &nbsp;|&nbsp; ⏱️ ${e.checkIn}–${e.checkOut || "?"}` : ""}
        ${e.notes    ? ` &nbsp;|&nbsp; 💬 ${e.notes}` : ""}
      </div>
      <div class="entry-actions" onclick="event.stopPropagation()">
        <button class="btn-edit"   onclick="openEditEntry('${e.id}')">✏️ עריכה</button>
        <button class="btn-delete" onclick="deleteEntry('${e.id}')">🗑️ מחק</button>
      </div>
    </div>
  `).join("");
}

window.filterEntries = function (mode, btn) {
  state.filterMode = mode;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  renderEntries();
};

// ─── הוסף רשומה חדשה ───
window.openNewEntry = function () {
  state.editingEntryId = null;
  document.getElementById("form-title").textContent = "רשומה חדשה";
  document.getElementById("form-entry-id").value = "";
  clearEntryForm();
  populateFormDropdowns();
  showView("view-entry-form");
};

// ─── עריכת רשומה קיימת ───
window.openEditEntry = function (id) {
  const entry = state.allEntries.find(e => e.id === id);
  if (!entry) return;
  state.editingEntryId = id;
  document.getElementById("form-title").textContent = `עריכה — ${entry.employeeName}`;
  populateFormDropdowns(entry);
  fillEntryForm(entry);
  showView("view-entry-form");
};

function fillEntryForm(e) {
  setVal("form-employee",       e.employeeName);
  setVal("form-project",        e.project);
  setVal("form-checkin",        e.checkIn);
  setVal("form-checkout",       e.checkOut);
  setVal("form-hours",          e.hoursWorked || "");
  setVal("form-withdrawals",    e.withdrawals || "");
  setVal("form-withdrawal-for", e.withdrawalFor || "");
  setVal("form-food",           e.food || "");
  setVal("form-parking",        e.parking || "");
  setVal("form-fuel",           e.fuel || "");
  setVal("form-accommodation",  e.accommodation || "");
  setVal("form-owner-cost",     e.projectOwnerCost || "");
  setVal("form-notes",          e.notes || "");
  updateCostPreview();
}

function clearEntryForm() {
  ["form-employee","form-project","form-checkin","form-checkout",
   "form-hours","form-withdrawals","form-withdrawal-for","form-food",
   "form-parking","form-fuel","form-accommodation","form-owner-cost","form-notes"]
    .forEach(id => setVal(id, ""));
  document.getElementById("form-cost-preview").classList.add("hidden");
}

function populateFormDropdowns(entry = null) {
  const empSel  = document.getElementById("form-employee");
  const projSel = document.getElementById("form-project");

  const empNames = state.employees.length > 0
    ? state.employees.map(e => e.name)
    : ["ELIAS", "KRES", "FAHIM"];

  empSel.innerHTML  = '<option value="">בחר עובד...</option>';
  projSel.innerHTML = '<option value="">בחר פרויקט...</option>';

  empNames.forEach(n => {
    const o = new Option(n, n);
    if (entry && entry.employeeName === n) o.selected = true;
    empSel.appendChild(o);
  });
  state.projects.forEach(p => {
    const o = new Option(p.name, p.name);
    if (entry && entry.project === p.name) o.selected = true;
    projSel.appendChild(o);
  });
}

window.onEmployeeChange = function () {
  const name = document.getElementById("form-employee").value;
  const emp  = state.employees.find(e => e.name === name);
  if (emp) updateCostPreview();
};

function updateCostPreview() {
  const empName = document.getElementById("form-employee").value;
  const hours   = parseFloat(document.getElementById("form-hours").value) || 0;
  const emp     = state.employees.find(e => e.name === empName);
  if (!emp || !hours) {
    document.getElementById("form-cost-preview").classList.add("hidden");
    return;
  }
  const cost = calcCost(emp, hours);
  const preview = document.getElementById("form-cost-preview");
  preview.textContent = `💰 עלות מחושבת: ₪${cost.toFixed(2)}  (${emp.salaryType} | תעריף: ₪${emp.dailyRate})`;
  preview.classList.remove("hidden");
}

document.getElementById("form-hours")?.addEventListener("input", updateCostPreview);

window.saveEntry = async function () {
  const employeeName  = document.getElementById("form-employee").value;
  const project       = document.getElementById("form-project").value;
  if (!employeeName || !project) { alert("יש לבחור עובד ופרויקט"); return; }

  const emp     = state.employees.find(e => e.name === employeeName) || {};
  const hours   = parseFloat(document.getElementById("form-hours").value) || 0;
  const cost    = calcCost(emp, hours);

  const data = {
    employeeName,
    project,
    date:          state.editingEntryId
                     ? (state.allEntries.find(e => e.id === state.editingEntryId)?.date || getDateStr())
                     : getDateStr(),
    dayOfWeek:     state.editingEntryId
                     ? (state.allEntries.find(e => e.id === state.editingEntryId)?.dayOfWeek || getDayHebrew())
                     : getDayHebrew(),
    checkIn:       document.getElementById("form-checkin").value,
    checkOut:      document.getElementById("form-checkout").value,
    hoursWorked:   hours,
    withdrawals:   parseFloat(document.getElementById("form-withdrawals").value)    || 0,
    withdrawalFor: document.getElementById("form-withdrawal-for").value.trim(),
    food:          parseFloat(document.getElementById("form-food").value)           || 0,
    parking:       parseFloat(document.getElementById("form-parking").value)        || 0,
    fuel:          parseFloat(document.getElementById("form-fuel").value)           || 0,
    accommodation: parseFloat(document.getElementById("form-accommodation").value)  || 0,
    projectOwnerCost: parseFloat(document.getElementById("form-owner-cost").value) || 0,
    notes:         document.getElementById("form-notes").value.trim(),
    salaryType:    emp.salaryType || "",
    payer:         emp.payer      || "",
    dailyRate:     emp.dailyRate  || 0,
    calculatedCost: cost,
    isComplete:    true,
    createdAt:     state.editingEntryId
                     ? (state.allEntries.find(e => e.id === state.editingEntryId)?.createdAt || Date.now())
                     : Date.now(),
  };

  if (state.editingEntryId) {
    await updateDoc(doc(db, "entries", state.editingEntryId), data);
  } else {
    await addDoc(collection(db, "entries"), data);
  }

  showView("view-manager");
};

window.deleteEntry = async function (id) {
  if (!confirm("למחוק רשומה זו?")) return;
  await deleteDoc(doc(db, "entries", id));
};

// ═══════════════════════════════════════════
//  ייצוא Excel
// ═══════════════════════════════════════════
window.exportExcel = function () {
  const complete = state.allEntries.filter(e => e.isComplete);
  if (complete.length === 0) { alert("אין רשומות מוכנות לייצוא"); return; }

  const rows = [HEADERS, ...complete.map(e => [
    e.dayOfWeek, e.date, e.employeeName, e.salaryType, e.project,
    e.checkIn, e.checkOut, e.hoursWorked,
    e.withdrawals || "", e.withdrawalFor || "",
    e.food || "", e.parking || "", e.fuel || "", e.accommodation || "",
    e.payer, e.dailyRate, e.calculatedCost,
    e.projectOwnerCost || "", e.notes || "",
  ])];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "WorkLog");
  XLSX.writeFile(wb, "WorkLog_JSConstructions.xlsx");
};

// ═══════════════════════════════════════════
//  הגדרות — עובדים ופרויקטים
// ═══════════════════════════════════════════
async function loadEmployees() {
  const snap = await getDocs(collection(db, "employees"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadProjects() {
  const snap = await getDocs(collection(db, "projects"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ═══════════════════════════════════════════
//  Import from Excel (EmployeesDB sheet)
// ═══════════════════════════════════════════
window.importFromExcel = async function (input) {
  const file = input.files[0];
  if (!file) return;

  const statusEl = document.getElementById("import-status");
  statusEl.textContent = "⏳ מייבא נתונים...";
  statusEl.classList.remove("hidden");

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data  = new Uint8Array(e.target.result);
      const wb    = XLSX.read(data, { type: "array" });

      // Find EmployeesDB sheet (case-insensitive)
      const sheetName = wb.SheetNames.find(
        n => n.toLowerCase().replace(/\s/g,"") === "employeesdb"
      ) || wb.SheetNames[0];

      const ws   = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      // Skip header row — columns: name, salaryType, dailyRate, contractorRate, payer, projectName, projectBudget
      const employees = [];
      const projectNames = new Set();

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = String(row[0] || "").trim();
        if (!name) continue;

        const salaryType = String(row[1] || "").trim();
        const dailyRate  = parseFloat(row[2]) || 0;
        const payer      = String(row[4] || "").trim();
        const project    = String(row[5] || "").trim();

        employees.push({ name, salaryType, dailyRate, payer, projectName: project });
        if (project) projectNames.add(project);
      }

      // Save employees to Firestore
      for (const emp of employees) {
        await addDoc(collection(db, "employees"), emp);
      }

      // Save projects to Firestore
      for (const proj of projectNames) {
        await addDoc(collection(db, "projects"), { name: proj });
      }

      statusEl.textContent = `✅ יובאו ${employees.length} עובדים ו-${projectNames.size} פרויקטים בהצלחה!`;
      input.value = "";
      loadSettingsData();
    } catch (err) {
      statusEl.textContent = "❌ שגיאה בקריאת הקובץ: " + err.message;
    }
  };
  reader.readAsArrayBuffer(file);
};

window.addEmployee = async function () {
  const name = document.getElementById("new-emp-name").value.trim();
  if (!name) return;
  await addDoc(collection(db, "employees"), {
    name, salaryType: "יומי", dailyRate: 0, payer: "", projectName: ""
  });
  document.getElementById("new-emp-name").value = "";
  loadSettingsData();
};

window.addProject = async function () {
  const name = document.getElementById("new-project-name").value.trim();
  if (!name) return;
  await addDoc(collection(db, "projects"), { name });
  document.getElementById("new-project-name").value = "";
  loadSettingsData();
};

window.removeEmployee = async function (id) {
  if (!confirm("למחוק עובד זה?")) return;
  await deleteDoc(doc(db, "employees", id));
  loadSettingsData();
};

window.removeProject = async function (id) {
  if (!confirm("למחוק פרויקט זה?")) return;
  await deleteDoc(doc(db, "projects", id));
  loadSettingsData();
};

async function loadSettingsData() {
  state.employees = await loadEmployees();
  state.projects  = await loadProjects();

  const empList  = document.getElementById("employees-list");
  const projList = document.getElementById("projects-list");

  empList.innerHTML = state.employees.length === 0
    ? '<div class="empty-state">אין עובדים עדיין</div>'
    : state.employees.map(e => `
        <div class="settings-item">
          <span>${e.name} — ${e.salaryType || ""} ${e.dailyRate ? "₪"+e.dailyRate : ""}</span>
          <button class="btn-remove" onclick="removeEmployee('${e.id}')">✕</button>
        </div>`).join("");

  projList.innerHTML = state.projects.length === 0
    ? '<div class="empty-state">אין פרויקטים עדיין</div>'
    : state.projects.map(p => `
        <div class="settings-item">
          <span>${p.name}</span>
          <button class="btn-remove" onclick="removeProject('${p.id}')">✕</button>
        </div>`).join("");
}

// Override showView for settings
const _origShowView = showView;
window.showView = function (id) {
  _origShowView(id);
  if (id === "view-settings") loadSettingsData();
};

// ═══════════════════════════════════════════
//  עזרים
// ═══════════════════════════════════════════
function getNowTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
}

function getDateStr() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()}`;
}

function getDayHebrew() {
  const days = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
  return days[new Date().getDay()];
}

function calcCost(emp, hours) {
  const rate = emp.dailyRate || 0;
  const type = (emp.salaryType || "").toLowerCase();
  if (type.includes("שעתי") || type.includes("hour")) return hours * rate;
  return rate;
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? "";
}
