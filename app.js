const STORAGE_KEY = "patientTrackerStandaloneV1";

/**
 * antibiotic item:
 * - name
 * - startDate
 * - endDate
 */

/** @typedef {{ id: string, name: string, startDate: string, endDate: string, isOral?: boolean }} AntibioticItem */
/** @typedef {{ id: string, date: string, content: string }} NoteItem */
/** @typedef {{ id: string, title: string, notes: NoteItem[] | string[] }} Problem */
/** @typedef {{ id: string, bed: string, admitDate: string, name: string, chartNo: string, sex: string, age: string, todos: string[], status: string[], antibiotics: AntibioticItem[], problems: Problem[], dischargeDate?: string }} Patient */
/** @typedef {{ id: string, name: string, patients: Patient[] }} Attending */
/** @typedef {{ attendings: Attending[] }} TrackerState */

const STATUS_OPTIONS = [
  "DNR all",
  "DNR除藥",
  "NG",
  "foley",
  "CVC",
  {
    group: "抽血",
    options: ["一", "二", "三", "四", "五"]
  },
  {
    group: "O₂",
    options: [
      { type: "checkbox", value: "room air" },
      { type: "checkbox", value: "NRM" },
      { type: "checkbox", value: "BIPAP" },
      { type: "checkbox", value: "呼吸器" },
      { type: "checkbox", value: "HFNC" },
      { type: "dropdown", value: "nasal", options: ["1L", "2L", "3L", "4L", "5L", "6L"] },
      { type: "dropdown", value: "mask", options: ["5L", "6L", "7L", "8L"] }
    ]
  }
];

const DEFAULT_ANTIBIOTICS = [
  "Amoxicillin",
  "Amoxicillin/Clavulanate",
  "Ampicillin",
  "Ampicillin/Sulbactam",
  "Penicillin G",
  "Oxacillin",
  "Piperacillin/Tazobactam",
  "Tazocin",
  "Cefazolin",
  "Cephalexin",
  "Cefuroxime",
  "Cefotaxime",
  "Ceftriaxone",
  "Ceftazidime",
  "Cefepime",
  "Cefpirome",
  "Cefmetazole",
  "Flomoxef",
  "Cefoperazone/Sulbactam",
  "Sulperazon",
  "Brosym",
  "Imipenem/Cilastatin",
  "Meropenem",
  "Ertapenem",
  "Doripenem",
  "Aztreonam",
  "Vancomycin",
  "Teicoplanin",
  "Daptomycin",
  "Linezolid",
  "Clindamycin",
  "Metronidazole",
  "Azithromycin",
  "Clarithromycin",
  "Erythromycin",
  "Gentamicin",
  "Amikacin",
  "Tobramycin",
  "Ciprofloxacin",
  "Levofloxacin",
  "Moxifloxacin",
  "Trimethoprim/Sulfamethoxazole",
  "Bactrim",
  "Tigecycline",
  "Colistin",
  "Polymyxin B",
  "Doxycycline",
  "Minocycline",
  "Nitrofurantoin",
  "Fosfomycin",
  "Rifampin",
  "Rifampicin",
  "Isoniazid",
  "Ethambutol",
  "Pyrazinamide",
  "Cefiderocol",
  "Ceftaroline",
  "Ceftolozane/Tazobactam",
  "Avycaz",
  "Sulbactam/Durlobactam",
  "Unasyn",
  "Augmentin",
  "Invanz",
  "Tienam",
  "Maxipime",
  "Fortum",
  "Rocephin",
  "Zinacef",
  "Kefzol",
  "Dalacin",
  "Flagyl",
  "Zyvox",
  "Cubicin",
  "Targocid",
  "Colimycin"
];

const attendingSections = document.getElementById("attendingSections");
const emptyState = document.getElementById("emptyState");
const addAttendingForm = document.getElementById("addAttendingForm");
const searchInput = document.getElementById("searchInput");
const exportBtn = document.getElementById("exportBtn");
const jsonDialog = document.getElementById("jsonDialog");
const jsonOutput = document.getElementById("jsonOutput");
const copyJsonBtn = document.getElementById("copyJsonBtn");

if (
  !attendingSections ||
  !emptyState ||
  !addAttendingForm ||
  !searchInput ||
  !exportBtn ||
  !jsonDialog ||
  !jsonOutput ||
  !copyJsonBtn
) {
  throw new Error("Patient Tracker: 初始化失敗（找不到必要的 DOM 元素）。");
}

/** @type {TrackerState} */
let state = loadState();

/** @type {Set<string>} */
const expandedPatients = new Set();

/** @type {{ patientId: string, idx: number } | null} */
let editingTodo = null;

/** @type {string | null} */
let editingNoteId = null;

/** @type {string | null} */
let editingAbxId = null;

/** @type {string | null} */
let expandedAddPatientAttendingId = null;

/** @type {string | null} */
let editingPatientInfoId = null;

/** @type {string | null} */
let editingAttendingId = null;

/** @type {string | null} */
let dischargingPatientId = null;

/** @type {boolean} */
let isViewMode = true;

/** @type {boolean} */
let isAddAttendingVisible = false;

/** @type {boolean} */
let isSearchVisible = false;

/** @type {Set<string>} */
const expandedDischargedAttendings = new Set();

function formatDateShort(dateStr) {
  if (!dateStr) return "?";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  return `${m}/${d}`;
}

function formatMd(d) {
  if (!d) return "📅";
  const parts = d.split("-");
  if (parts.length < 3) return "📅";
  return `${parts[1]}/${parts[2]}`;
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeSearch(text) {
  return String(text || "").trim().toLowerCase();
}

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isExpiredAbx(abx, today) {
  const end = (abx.endDate || "").trim();
  return !!end && end < today;
}

function isActiveAbx(abx, today) {
  const start = (abx.startDate || "").trim();
  const end = (abx.endDate || "").trim();
  if (start && start > today) return false;
  if (end && end < today) return false;
  return true;
}

/** @param {Problem} problem */
function normalizeNotes(problem) {
  const raw = problem.notes || [];
  if (!Array.isArray(raw)) return [];
  // Backward compatibility: old data used string[]
  if (raw.length > 0 && typeof raw[0] === "string") {
    return raw
      .map((content) => ({
        id: uid("note"),
        date: "",
        content: String(content || "")
      }))
      .filter((n) => n.content.trim().length > 0);
  }
  return raw
    .map((n) => {
      if (!n || typeof n !== "object") return null;
      return {
        id: typeof n.id === "string" ? n.id : uid("note"),
        date: typeof n.date === "string" ? n.date : "",
        content: typeof n.content === "string" ? n.content : ""
      };
    })
    .filter(Boolean);
}

/** @param {NoteItem[]} notes */
function sortNotesByDate(notes) {
  // Date is YYYY-MM-DD; keep undated last
  return [...notes].sort((a, b) => {
    const ad = (a.date || "").trim();
    const bd = (b.date || "").trim();
    // chronological order by selected calendar date (not creation time)
    if (ad && bd) return ad.localeCompare(bd);
    if (ad && !bd) return -1;
    if (!ad && bd) return 1;
    return 0;
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { attendings: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.attendings)) {
      return { attendings: [] };
    }
    return { attendings: parsed.attendings };
  } catch {
    return { attendings: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function findAttending(attendingId) {
  return state.attendings.find((a) => a.id === attendingId) || null;
}

function findPatient(attendingId, patientId) {
  const attending = findAttending(attendingId);
  if (!attending) return null;
  const patient = attending.patients.find((p) => p.id === patientId) || null;
  return { attending, patient };
}

function findProblem(attendingId, patientId, problemId) {
  const found = findPatient(attendingId, patientId);
  if (!found || !found.patient) return null;
  const problem = found.patient.problems.find((pr) => pr.id === problemId) || null;
  return { ...found, problem };
}

function attendingMatchesQuery(att, q) {
  if (!q) return true;
  return (att.name || "").toLowerCase().includes(q);
}

function patientMatchesQuery(patient, q) {
  if (!q) return true;
  const hay = [
    patient.name,
    patient.chartNo,
    patient.bed,
    patient.admitDate,
    patient.sex,
    patient.age,
    patient.todos.join(" "),
    patient.antibiotics.map((a) => `${a.name} ${a.startDate} ${a.endDate}`).join(" "),
    patient.problems
      .map((p) => {
        const notes = normalizeNotes(p);
        return `${p.title} ${notes.map((n) => `${n.date} ${n.content}`).join(" ")}`;
      })
      .join(" ")
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function sortAttendings(attendings) {
  return [...attendings].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

function sortPatients(patients) {
  return [...patients].sort((a, b) => {
    const ab = (a.bed || "").toLowerCase();
    const bb = (b.bed || "").toLowerCase();
    if (ab !== bb) return ab.localeCompare(bb, undefined, { numeric: true });
    return (a.name || "").localeCompare(b.name || "");
  });
}

function renderPatientItem(p, att, today, q) {
  const isOpen = expandedPatients.has(p.id);
  const name = escapeHtml(p.name || "(未命名)");
  const bed = escapeHtml(p.bed || "-");
  const chartNo = escapeHtml(p.chartNo || "-");
  const admitDate = escapeHtml(p.admitDate || "-");
  const sex = escapeHtml(p.sex || "-");
  const age = escapeHtml(p.age || "-");

  const todosHtml = p.todos
    .map((t, idx) => {
      const isEditing = !isViewMode && !!editingTodo && editingTodo.patientId === p.id && editingTodo.idx === idx;
      if (isEditing) {
        return `
          <form class="row todo-edit-form" data-action="editTodoForm" data-att="${att.id}" data-p="${p.id}" data-idx="${idx}">
            <input name="text" value="${escapeHtml(t)}" autocomplete="off" required />
            <button type="submit">Save</button>
            <button type="button" class="mini-ghost" data-action="cancelEditTodo">Cancel</button>
            <button type="button" class="mini-danger" data-action="delTodo" data-att="${att.id}" data-p="${p.id}" data-idx="${idx}">🗑️</button>
          </form>
        `;
      }
      return `
        <div class="row ${isViewMode ? "view-row" : ""}">
          <div class="row-main ${isViewMode ? "" : "clickable"}" ${
        isViewMode ? "" : `data-action="startEditTodo" data-p="${p.id}" data-idx="${idx}"`
      }>${escapeHtml(t)}</div>
        </div>
      `;
    })
    .join("");

  const sortedAbx = [...(p.antibiotics || [])].sort((a, b) => {
    const s1 = a.startDate || "";
    const s2 = b.startDate || "";
    return s1.localeCompare(s2);
  });

  const abxHtml = sortedAbx
    .map((a) => {
      const active = isActiveAbx(a, today);
      const expired = isExpiredAbx(a, today);
      const cls = expired ? "abx-expired" : active ? "abx-active" : "";
      const isEditing = !isViewMode && editingAbxId === a.id;

      if (isEditing) {
        return `
          <form class="row abx-edit-form" data-action="editAbxForm" data-att="${att.id}" data-p="${p.id}" data-abx="${a.id}">
            <div class="abx-inputs">
              <input name="name" list="abxList" value="${escapeHtml(a.name)}" required placeholder="Select drug" />
              <div class="date-with-icon"><span>${formatMd(a.startDate)}</span><input name="startDate" type="date" value="${escapeHtml(a.startDate || "")}" /></div>
              <div class="date-with-icon"><span>${formatMd(a.endDate)}</span><input name="endDate" type="date" value="${escapeHtml(a.endDate || "")}" /></div>
              <label class="check-label"><input name="isOral" type="checkbox" ${a.isOral ? "checked" : ""} /> oral</label>
            </div>
            <div class="row-actions">
              <button type="submit">Save</button>
              <button type="button" class="mini-ghost" data-action="cancelEditAbx">Cancel</button>
              <button type="button" class="mini-danger" data-action="delAbxItem" data-att="${att.id}" data-p="${p.id}" data-abx="${a.id}">🗑️</button>
            </div>
          </form>
        `;
      }

      const start = formatDateShort(a.startDate);
      const end = formatDateShort(a.endDate);
      const oralTag = a.isOral ? " oral" : "";
      return `
        <div class="row ${cls}">
          <div class="row-main abx-name ${isViewMode ? "" : "clickable"}" ${
        isViewMode ? "" : `data-action="startEditAbx" data-abx="${a.id}"`
      }>${escapeHtml(a.name)}(${escapeHtml(start)}-${escapeHtml(end)})${oralTag}</div>
        </div>
      `;
    })
    .join("");

  const statusList = p.status || [];
  
  // Function to process status list for view mode display
  function processStatusForView(statusList) {
    const processed = [];
    const bloodDrawOptions = [];
    const otherOptions = [];
    const dropdownOptions = new Map();
    
    // Separate different types of options
    statusList.forEach(item => {
      if (item.startsWith('抽血 ')) {
        bloodDrawOptions.push(item.replace('抽血 ', ''));
      } else if (item === 'room air' || item === 'NRM' || item === 'BIPAP' || item === '呼吸器' || item === 'HFNC') {
        // O₂ simple options
        otherOptions.push(item);
      } else if (item.startsWith('nasal ') || item.startsWith('mask ')) {
        const parts = item.split(' ');
        const group = parts[0];
        const value = parts[1];
        if (!dropdownOptions.has(group)) {
          dropdownOptions.set(group, []);
        }
        dropdownOptions.get(group).push(value);
      } else {
        otherOptions.push(item);
      }
    });
    
    // Add other options first
    otherOptions.forEach(item => {
      processed.push(item);
    });
    
    // Add blood draw as grouped item if any options are selected
    if (bloodDrawOptions.length > 0) {
      processed.push(`${bloodDrawOptions.join('、')}抽血`);
    }
    
    // Add dropdown options
    dropdownOptions.forEach((values, group) => {
      if (values.length > 0) {
        processed.push(`${group} ${values.join('、')}`);
      }
    });
    
    return processed;
  }
  
  const statusHtml = isViewMode
    ? processStatusForView(statusList)
        .map(
          (s) => `
        <div class="row view-row">
          <div class="row-main">${escapeHtml(s)}</div>
        </div>
      `
        )
        .join("")
    : `
      <div class="status-grid">
        ${STATUS_OPTIONS.map(
          (opt) => {
            if (typeof opt === 'string') {
              return `
              <label class="status-opt">
                <input type="checkbox" data-action="toggleStatus" data-p="${p.id}" data-opt="${escapeHtml(
                  opt
                )}" ${statusList.includes(opt) ? "checked" : ""} />
                <span>${escapeHtml(opt)}</span>
              </label>
              `;
            } else if (opt.group && opt.options) {
              if (opt.group === 'O₂') {
                return `
              <div class="status-group">
                <div class="status-group-title">${escapeHtml(opt.group)}</div>
                <div class="status-oxygen-options">
                  ${opt.options.map(
                    (subOpt) => {
                      if (subOpt.type === 'checkbox') {
                        return `
                        <label class="status-opt status-sub-opt">
                          <input type="checkbox" data-action="toggleOxygenOption" data-p="${p.id}" data-opt="${escapeHtml(
                            subOpt.value
                          )}" ${statusList.includes(subOpt.value) ? "checked" : ""} />
                          <span>${escapeHtml(subOpt.value)}</span>
                        </label>
                        `;
                      } else if (subOpt.type === 'dropdown') {
                        return `
                        <div class="status-dropdown">
                          <select class="status-select" data-action="toggleOxygenDropdown" data-p="${p.id}" data-group="${escapeHtml(subOpt.value)}">
                            <option value="">${escapeHtml(subOpt.value)}</option>
                            ${subOpt.options.map(
                              (option) => `
                                <option value="${escapeHtml(option)}" ${statusList.includes(subOpt.value + ' ' + option) ? "selected" : ""}>${escapeHtml(option)}</option>
                                `
                            ).join("")}
                          </select>
                        </div>
                        `;
                      }
                      return '';
                    }
                  ).join("")}
                </div>
              </div>
                `;
              } else {
                return `
              <div class="status-group">
                <div class="status-group-title">${escapeHtml(opt.group)}</div>
                <div class="status-group-options">
                  ${opt.options.map(
                    (subOpt) => `
                    <label class="status-opt status-sub-opt">
                      <input type="checkbox" data-action="toggleStatus" data-p="${p.id}" data-opt="${escapeHtml(
                        opt.group + ' ' + subOpt
                      )}" ${statusList.includes(opt.group + ' ' + subOpt) ? "checked" : ""} />
                      <span>${escapeHtml(subOpt)}</span>
                    </label>
                    `
                  ).join("")}
                </div>
              </div>
                `;
              }
            }
            return '';
          }
        ).join("")}
      </div>
    `;

  const problemsHtml = p.problems
    .map((pr) => {
      const normalized = normalizeNotes(pr);
      const sortedNotes = sortNotesByDate(normalized);
      const groups = new Map();
      for (const n of sortedNotes) {
        const key = (n.date || "").trim() || "未指定日期";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(n);
      }

      const notesHtml = Array.from(groups.entries())
        .map(([date, notes]) => {
          const noteItems = notes
            .map((n) => {
              const isEditing = !isViewMode && editingNoteId === n.id;
              if (isEditing) {
                return `
                  <form class="row note-edit-form" data-action="editNoteForm" data-att="${att.id}" data-p="${p.id}" data-pr="${pr.id}" data-note="${n.id}">
                    <div class="date-with-icon">📅<input name="date" type="date" value="${escapeHtml(n.date || "")}" required /></div>
                    <input name="content" value="${escapeHtml(n.content)}" autocomplete="off" required />
                    <button type="submit">Save</button>
                    <button type="button" class="mini-ghost" data-action="cancelEditNote">Cancel</button>
                    <button type="button" class="mini-danger" data-action="delNote" data-att="${att.id}" data-p="${p.id}" data-pr="${pr.id}" data-note="${n.id}">🗑️</button>
                  </form>
                `;
              }
              return `<div class="row ${isViewMode ? "view-row" : ""}">
                  <div class="row-main ${isViewMode ? "" : "clickable"}" ${
                isViewMode ? "" : `data-action="startEditNote" data-note="${n.id}"`
              }>${escapeHtml(n.content)}</div>
                </div>`;
            })
            .join("");

          return `
            <div class="note-day">
              <div class="note-day-header">
                <div class="note-day-title">${escapeHtml(date)}</div>
                ${
                  isViewMode
                    ? ""
                    : `
                <form class="mini-add-note" data-action="addNoteSpecificForm" data-att="${att.id}" data-p="${p.id}" data-pr="${pr.id}" data-date="${escapeHtml(
                        date
                      )}">
                  <input name="content" placeholder="new notes" autocomplete="off" required />
                  <button type="submit">+</button>
                </form>
                `
                }
              </div>
              <div class="note-day-items">${noteItems}</div>
            </div>
          `;
        })
        .join("");

      return `
        <div class="problem">
          <div class="problem-header">
            <div class="problem-title">${escapeHtml(pr.title || "(未命名 problem)")}</div>
            ${
              isViewMode
                ? ""
                : `<button type="button" class="mini-danger" data-action="delProblem" data-att="${att.id}" data-p="${p.id}" data-pr="${pr.id}">🗑️</button>`
            }
          </div>
          <div class="notes">
            ${notesHtml || ""}
          </div>
          ${
            isViewMode
              ? ""
              : `
          <form class="inline" data-action="addNoteForm" data-att="${att.id}" data-p="${p.id}" data-pr="${pr.id}">
            <div class="date-with-icon">📅<input name="date" type="date" required /></div>
            <input name="content" placeholder="New note" autocomplete="off" required />
            <button type="submit">Add (+)</button>
          </form>
          `
          }
        </div>
      `;
    })
    .join("");

  const editActions = isViewMode
    ? ""
    : `
    ${
      editingPatientInfoId === p.id
        ? ""
        : `<button type="button" class="mini-ghost" data-action="startEditPatientInfo" data-p="${p.id}">🖊️</button>`
    }
    ${
      p.dischargeDate
        ? `<button type="button" class="mini-ghost" data-action="reActivatePatient" data-att="${att.id}" data-p="${p.id}">恢復住院</button>`
        : `<button type="button" class="mini-ghost" data-action="startDischarge" data-p="${p.id}">🏡</button>`
    }
    <button type="button" class="mini-danger" data-action="delPatient" data-att="${att.id}" data-p="${p.id}">🗑️</button>
  `;

  return `
    <article class="patient ${isViewMode ? "view-mode-patient" : ""}" data-att="${att.id}" data-p="${p.id}">
      <div class="patient-header">
        <button class="patient-summary" type="button" data-action="togglePatient" data-att="${att.id}" data-p="${p.id}">
          <div class="patient-summary-left">
            <span class="patient-name">${name}</span>
            <span class="badge">${bed}</span>
            <span class="patient-meta">${chartNo}</span>
            <span class="patient-meta">${formatDateShort(p.admitDate)}</span>
            <span class="patient-meta">${sex} / ${age}</span>
            ${
              p.dischargeDate
                ? `<span class="badge discharge-badge">OUT ${formatDateShort(p.dischargeDate)}</span>`
                : ""
            }
          </div>
        </button>
        <div class="patient-header-actions">
          ${editActions}
        </div>
      </div>
      ${
        isOpen
          ? `
        <div class="patient-details">

          ${
            !isViewMode && dischargingPatientId === p.id
              ? `
            <form class="discharge-form" data-action="confirmDischargeForm" data-att="${att.id}" data-p="${p.id}">
              <label><span>出院日期</span><input name="date" type="date" value="${todayYmd()}" required /></label>
              <button type="submit">Confirm Discharge</button>
              <button type="button" class="mini-ghost" data-action="cancelDischarge">Cancel</button>
            </form>
          `
              : ""
          }

          ${
            !isViewMode && editingPatientInfoId === p.id
              ? `
            <form class="two-col-form" data-action="editPatientInfoForm" data-att="${att.id}" data-p="${p.id}">
              <label><span>姓名</span><input name="name" value="${escapeHtml(p.name || "")}" required /></label>
              <label><span>床號</span><input name="bed" value="${escapeHtml(p.bed || "")}" inputmode="numeric" /></label>
              <label><span>入院日期</span><input name="admitDate" type="date" value="${escapeHtml(p.admitDate || "")}" /></label>
              <label><span>病歷號</span><input name="chartNo" value="${escapeHtml(p.chartNo || "")}" inputmode="numeric" pattern="[0-9]*" /></label>
              <label>
                <span>性別</span>
                <select name="sex">
                  <option value="">-</option>
                  <option value="M" ${p.sex === "M" ? "selected" : ""}>M</option>
                  <option value="F" ${p.sex === "F" ? "selected" : ""}>F</option>
                </select>
              </label>
              <label><span>年齡</span><input name="age" value="${escapeHtml(p.age || "")}" inputmode="numeric" pattern="[0-9]*" /></label>
              <div class="form-actions-row">
                <button type="submit">Save</button>
                <button type="button" class="mini-ghost" data-action="cancelEditPatientInfo">Cancel</button>
              </div>
            </form>
          `
              : ""
          }

          ${
            p.todos.length > 0 || !isViewMode
              ? `
          <div>
            <div class="section-title">To do list</div>
            <div class="list">${todosHtml || ""}</div>
            ${
              isViewMode
                ? ""
                : `
            <form class="inline" data-action="addTodoForm" data-att="${att.id}" data-p="${p.id}">
              <input name="text" placeholder="What's next?" autocomplete="off" />
              <button type="submit">Add (+)</button>
            </form>
            `
            }
          </div>
          `
              : ""
          }

          ${
            (p.status || []).length > 0 || !isViewMode
              ? `
          <div class="status-section">
            <div class="section-title">Status</div>
            ${statusHtml || ""}
          </div>
          `
              : ""
          }

          ${
            (p.antibiotics || []).length > 0 || !isViewMode
              ? `
          <div>
            <div class="section-title">Antibiotics</div>
            <div class="list">${abxHtml || ""}</div>
            ${
              isViewMode
                ? ""
                : `
            <form class="inline abx-add-form" data-action="addAbxItemForm" data-att="${att.id}" data-p="${p.id}">
              <input name="name" list="abxList" placeholder="Select drug" autocomplete="off" />
              <div class="abx-add-row-2">
                <div class="date-with-icon"><span>📅</span><input name="startDate" type="date" /></div>
                <div class="date-with-icon"><span>📅</span><input name="endDate" type="date" /></div>
                <label class="check-label"><input name="isOral" type="checkbox" /> oral</label>
                <button type="submit">Add (+)</button>
              </div>
            </form>
            `
            }
          </div>
          `
              : ""
          }

          ${
            p.problems.length > 0 || !isViewMode
              ? `
          <div>
            <div class="section-title">Diagnosis</div>
            <div class="notes">${problemsHtml || `<div class="patient-meta">no diagnosis</div>`}</div>
            ${
              isViewMode
                ? ""
                : `
            <form class="inline add-diagnosis-form" data-action="addProblemForm" data-att="${att.id}" data-p="${p.id}">
              <input name="title" placeholder="New diagnosis" autocomplete="off" />
              <button type="submit">Add (+)</button>
            </form>
            `
            }
          </div>
          `
              : ""
          }
        </div>
      `
          : ""
      }
    </article>
  `;
}

function render() {
  const q = normalizeSearch(searchInput.value);
  const attendings = sortAttendings(state.attendings);
  const today = todayYmd();

  // Update mode toggle button text
  const modeBtn = document.getElementById("modeToggleBtn");
  if (modeBtn) {
    modeBtn.textContent = isViewMode ? "🖊️" : "👁️";
  }

  const addAttendingSection = document.getElementById("addAttendingSection");
  if (addAttendingSection) {
    addAttendingSection.style.display = isAddAttendingVisible ? "block" : "none";
  }

  const searchContainer = document.getElementById("searchContainer");
  if (searchContainer) {
    searchContainer.style.display = isSearchVisible ? "block" : "none";
  }

  if (attendings.length === 0) {
    attendingSections.innerHTML = "";
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  const datalistHtml = `
    <datalist id="abxList">
      ${DEFAULT_ANTIBIOTICS.map((n) => `<option value="${escapeHtml(n)}"></option>`).join("")}
    </datalist>
  `;

  const html = datalistHtml +
    [...attendings]
      .sort((a, b) => {
        const aHasActive = a.patients.some(p => !p.dischargeDate);
        const bHasActive = b.patients.some(p => !p.dischargeDate);
        if (aHasActive && !bHasActive) return -1;
        if (!aHasActive && bHasActive) return 1;
        return 0;
      })
      .map((att) => {
        const attShouldShow = attendingMatchesQuery(att, q);
        const patients = sortPatients(att.patients);
        const activePatients = patients.filter((p) => !p.dischargeDate);
        const dischargedPatients = patients.filter((p) => p.dischargeDate);

        const matchedPatients = patients.filter((p) => patientMatchesQuery(p, q));
        const hideWholeAttending = q && !attShouldShow && matchedPatients.length === 0;
        if (hideWholeAttending) return "";

        const showActivePatients = q ? activePatients.filter(p => patientMatchesQuery(p, q)) : activePatients;
        const showDischargedPatients = q ? dischargedPatients.filter(p => patientMatchesQuery(p, q)) : dischargedPatients;

        const activePatientsHtml = showActivePatients.map(p => renderPatientItem(p, att, today, q)).join("");
        const dischargedPatientsHtml = showDischargedPatients.map(p => renderPatientItem(p, att, today, q)).join("");

        return `
            <section class="attending-card" data-att="${att.id}">
              <div class="attending-header">
                <div class="attending-title">
                  ${
                    !isViewMode && editingAttendingId === att.id
                      ? `
                    <form class="inline-edit-att" data-action="saveAttendingNameForm" data-att="${att.id}">
                      <input name="name" value="${escapeHtml(att.name)}" autocomplete="off" required />
                      <button type="submit">Save</button>
                      <button type="button" class="mini-ghost" data-action="cancelEditAttending">Cancel</button>
                    </form>
                    `
                      : `<h3>${escapeHtml(att.name || "(未命名 attending)")}</h3>`
                  }
                </div>
                <div class="attending-actions">
                  ${
                    isViewMode
                      ? ""
                      : `
                  <button type="button" class="mini-ghost" data-action="startEditAttending" data-att="${att.id}">🖊️</button>
                  <button type="button" class="mini-ghost" data-action="toggleAddPatientForm" data-att="${att.id}">
                    ${expandedAddPatientAttendingId === att.id ? "✖️" : "➕"}
                  </button>
                  <button type="button" class="mini-danger" data-action="delAttending" data-att="${att.id}">🗑️</button>
                  `
                  }
                </div>
              </div>

              ${
                !isViewMode && expandedAddPatientAttendingId === att.id
                  ? `
                <form class="add-patient-form" data-action="addPatientForm" data-att="${att.id}">
                  <label><span>床號</span><input name="bed" autocomplete="off" placeholder="例如：12A" inputmode="numeric" /></label>
                  <label><span>入院</span><input name="admitDate" type="date" value="${today}" /></label>
                  <label><span>姓名</span><input name="name" autocomplete="off" required placeholder="例如：王小明" /></label>
                  <label><span>病歷號</span><input name="chartNo" autocomplete="off" placeholder="例如：123456" inputmode="numeric" pattern="[0-9]*" /></label>
                  <label>
                    <span>性別</span>
                    <select name="sex">
                      <option value="">-</option>
                      <option value="M">M</option>
                      <option value="F">F</option>
                    </select>
                  </label>
                  <label><span>年齡</span><input name="age" autocomplete="off" placeholder="例如：65" inputmode="numeric" pattern="[0-9]*" /></label>
                  <button type="submit">Add (+)</button>
                </form>
              `
                  : ""
              }

              <div class="patients">
                ${activePatientsHtml}
              </div>

              ${
                dischargedPatientsHtml
                  ? `
                <div class="discharged-section">
                  <button class="discharged-header" data-action="toggleDischarged" data-att="${att.id}">
                    <span class="section-title">已出院病人 (${dischargedPatients.length})</span>
                  </button>
                  ${
                    expandedDischargedAttendings.has(att.id)
                      ? `
                    <div class="patients">
                      ${dischargedPatientsHtml}
                    </div>
                  `
                      : ""
                  }
                </div>
              `
                  : ""
              }
            </section>
          `;
      })
      .join("");

  attendingSections.innerHTML = html || "";
}

addAttendingForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = /** @type {HTMLFormElement} */ (e.currentTarget);
  const fd = new FormData(form);
  const name = String(fd.get("name") || "").trim();
  if (!name) return;

  state.attendings.unshift({
    id: uid("att"),
    name,
    patients: []
  });
  isAddAttendingVisible = false;
  saveState();
  form.reset();
  render();
});

const toggleAddAttendingBtn = document.getElementById("toggleAddAttendingBtn");
if (toggleAddAttendingBtn) {
  toggleAddAttendingBtn.addEventListener("click", () => {
    isAddAttendingVisible = !isAddAttendingVisible;
    render();
  });
}

const toggleSearchBtn = document.getElementById("toggleSearchBtn");
if (toggleSearchBtn) {
  toggleSearchBtn.addEventListener("click", () => {
    isSearchVisible = !isSearchVisible;
    render();
    if (isSearchVisible) {
      setTimeout(() => {
        const input = document.getElementById("searchInput");
        if (input) input.focus();
      }, 50);
    }
  });
}

searchInput.addEventListener("input", () => render());

attendingSections.addEventListener("click", (e) => {
  const target = /** @type {HTMLElement} */ (e.target instanceof HTMLElement ? e.target : null);
  if (!target) return;
  const btn = target.closest("[data-action]");
  if (!(btn instanceof HTMLElement)) return;

  const action = btn.dataset.action;
  const attId = btn.dataset.att;
  const pId = btn.dataset.p;
  const prId = btn.dataset.pr;

  if (action === "startEditTodo") {
    const idx = Number(btn.dataset.idx);
    if (!pId || Number.isNaN(idx)) return;
    editingTodo = { patientId: pId, idx };
    render();
    return;
  }

  if (action === "cancelEditTodo") {
    editingTodo = null;
    render();
    return;
  }

  if (action === "startEditNote") {
    const noteId = btn.dataset.note;
    if (!noteId) return;
    editingNoteId = noteId;
    render();
    return;
  }

  if (action === "cancelEditNote") {
    editingNoteId = null;
    render();
    return;
  }

  if (action === "startEditAbx") {
    const abxId = btn.dataset.abx;
    if (!abxId) return;
    editingAbxId = abxId;
    render();
    return;
  }

  if (action === "cancelEditAbx") {
    editingAbxId = null;
    render();
    return;
  }

  if (action === "startEditAttending" && attId) {
    editingAttendingId = attId;
    render();
    return;
  }

  if (action === "cancelEditAttending") {
    editingAttendingId = null;
    render();
    return;
  }

  if (action === "toggleAddPatientForm" && attId) {
    expandedAddPatientAttendingId = expandedAddPatientAttendingId === attId ? null : attId;
    render();
    return;
  }

  if (action === "startEditPatientInfo") {
    const pId = btn.dataset.p;
    if (!pId) return;
    editingPatientInfoId = pId;
    render();
    return;
  }

  if (action === "cancelEditPatientInfo") {
    editingPatientInfoId = null;
    render();
    return;
  }

  if (action === "startDischarge") {
    dischargingPatientId = btn.dataset.p;
    render();
    return;
  }

  if (action === "cancelDischarge") {
    dischargingPatientId = null;
    render();
    return;
  }

  if (action === "reActivatePatient" && attId && pId) {
    const found = findPatient(attId, pId);
    if (!found || !found.patient) return;
    delete found.patient.dischargeDate;
    saveState();
    render();
    return;
  }

  if (action === "togglePatient" && attId && pId) {
    if (expandedPatients.has(pId)) expandedPatients.delete(pId);
    else expandedPatients.add(pId);
    render();
    return;
  }

  if (action === "toggleStatus" && pId) {
    const opt = btn.dataset.opt;
    if (!opt) return;
    const found = findPatient(attId, pId);
    if (!found || !found.patient) return;
    
    // Initialize status array if it doesn't exist
    if (!found.patient.status) {
      found.patient.status = [];
    }
    
    const statusArray = found.patient.status;
    const index = statusArray.indexOf(opt);
    
    if (index > -1) {
      // Remove the option if it's already checked
      statusArray.splice(index, 1);
    } else {
      // Add the option if it's not checked
      statusArray.push(opt);
    }
    
    saveState();
    render();
    return;
  }

  if (action === "toggleDischarged" && attId) {
    if (expandedDischargedAttendings.has(attId)) expandedDischargedAttendings.delete(attId);
    else expandedDischargedAttendings.add(attId);
    render();
    return;
  }

  if (action === "collapsePatient" && pId) {
    expandedPatients.delete(pId);
    render();
    return;
  }

  if (action === "delAttending" && attId) {
    const att = findAttending(attId);
    if (!att) return;
    const ok = confirm(`確定刪除 attending「${att.name}」？（將一併刪除底下所有病人）`);
    if (!ok) return;
    state.attendings = state.attendings.filter((a) => a.id !== attId);
    saveState();
    render();
    return;
  }

  if (action === "delPatient" && attId && pId) {
    const found = findPatient(attId, pId);
    if (!found || !found.patient) return;
    const ok = confirm(`確定刪除病人「${found.patient.name || "(未命名)"}」？`);
    if (!ok) return;
    found.attending.patients = found.attending.patients.filter((p) => p.id !== pId);
    expandedPatients.delete(pId);
    saveState();
    render();
    return;
  }

  if (action === "delTodo" && attId && pId) {
    const idx = Number(btn.dataset.idx);
    const found = findPatient(attId, pId);
    if (!found || !found.patient) return;
    if (Number.isNaN(idx)) return;
    if (editingTodo && editingTodo.patientId === pId && editingTodo.idx === idx) {
      editingTodo = null;
    }
    found.patient.todos.splice(idx, 1);
    saveState();
    render();
    return;
  }

  if (action === "delAbxItem" && attId && pId) {
    const abxId = btn.dataset.abx;
    const found = findPatient(attId, pId);
    if (!found || !found.patient || !abxId) return;
    found.patient.antibiotics = (found.patient.antibiotics || []).filter((a) => a.id !== abxId);
    saveState();
    render();
    return;
  }

  if (action === "delProblem" && attId && pId && prId) {
    const found = findProblem(attId, pId, prId);
    if (!found || !found.patient || !found.problem) return;
    const ok = confirm(`確定刪除 problem「${found.problem.title || "(未命名)"}」？`);
    if (!ok) return;
    found.patient.problems = found.patient.problems.filter((pr) => pr.id !== prId);
    saveState();
    render();
    return;
  }

  if (action === "delNote" && attId && pId && prId) {
    const noteId = btn.dataset.note;
    const found = findProblem(attId, pId, prId);
    if (!found || !found.problem) return;
    if (!noteId) return;
    if (editingNoteId === noteId) editingNoteId = null;
    const normalized = normalizeNotes(found.problem);
    const idx = normalized.findIndex((n) => n.id === noteId);
    if (idx === -1) return;
    normalized.splice(idx, 1);
    found.problem.notes = normalized;
    saveState();
    render();
  }
});

// Add change event listener specifically for status checkboxes and dropdowns
attendingSections.addEventListener("change", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
  
  const action = target.dataset.action;
  const pId = target.dataset.p;
  const attId = target.closest("[data-att]")?.dataset.att;
  
  if (action === "toggleStatus" && pId && target.dataset.opt && attId) {
    const opt = target.dataset.opt;
    const found = findPatient(attId, pId);
    if (!found || !found.patient) return;
    
    // Initialize status array if it doesn't exist
    if (!found.patient.status) {
      found.patient.status = [];
    }
    
    const statusArray = found.patient.status;
    
    if (target.checked) {
      // Add option if it's checked
      if (!statusArray.includes(opt)) {
        statusArray.push(opt);
      }
    } else {
      // Remove the option if it's unchecked
      const index = statusArray.indexOf(opt);
      if (index > -1) {
        statusArray.splice(index, 1);
      }
    }
    
    saveState();
    render();
  }
  
  if (action === "toggleStatusDropdown" && pId && target.dataset.group && attId) {
    const group = target.dataset.group;
    const value = target.value;
    const found = findPatient(attId, pId);
    if (!found || !found.patient) return;
    
    // Initialize status array if it doesn't exist
    if (!found.patient.status) {
      found.patient.status = [];
    }
    
    const statusArray = found.patient.status;
    
    // Remove all existing options for this group
    const existingOptions = statusArray.filter(item => item.startsWith(group + ' '));
    existingOptions.forEach(existing => {
      const index = statusArray.indexOf(existing);
      if (index > -1) {
        statusArray.splice(index, 1);
      }
    });
    
    // Add new selection if not empty
    if (value) {
      statusArray.push(`${group} ${value}`);
    }
    
    saveState();
    render();
  }
  
  if (action === "toggleOxygenOption" && pId && target.dataset.opt && attId) {
    const opt = target.dataset.opt;
    const found = findPatient(attId, pId);
    if (!found || !found.patient) return;
    
    // Initialize status array if it doesn't exist
    if (!found.patient.status) {
      found.patient.status = [];
    }
    
    const statusArray = found.patient.status;
    
    // Remove all O₂ related options (mutual exclusion)
    const oxygenOptions = statusArray.filter(item => 
      item === 'room air' || item === 'NRM' || item === 'BIPAP' || 
      item === '呼吸器' || item === 'HFNC' || 
      item.startsWith('nasal ') || item.startsWith('mask ')
    );
    
    oxygenOptions.forEach(existing => {
      const index = statusArray.indexOf(existing);
      if (index > -1) {
        statusArray.splice(index, 1);
      }
    });
    
    // Add new selection if checked
    if (target.checked) {
      statusArray.push(opt);
    }
    
    saveState();
    render();
  }
  
  if (action === "toggleOxygenDropdown" && pId && target.dataset.group && attId) {
    const group = target.dataset.group;
    const value = target.value;
    const found = findPatient(attId, pId);
    if (!found || !found.patient) return;
    
    // Initialize status array if it doesn't exist
    if (!found.patient.status) {
      found.patient.status = [];
    }
    
    const statusArray = found.patient.status;
    
    // Remove all O₂ related options (mutual exclusion)
    const oxygenOptions = statusArray.filter(item => 
      item === 'room air' || item === 'NRM' || item === 'BIPAP' || 
      item === '呼吸器' || item === 'HFNC' || 
      item.startsWith('nasal ') || item.startsWith('mask ')
    );
    
    oxygenOptions.forEach(existing => {
      const index = statusArray.indexOf(existing);
      if (index > -1) {
        statusArray.splice(index, 1);
      }
    });
    
    // Add new selection if not empty
    if (value) {
      statusArray.push(`${group} ${value}`);
    }
    
    saveState();
    render();
  }
});

attendingSections.addEventListener("submit", (e) => {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;

  const action = form.dataset.action;
  const attId = form.dataset.att;
  const pId = form.dataset.p;
  const prId = form.dataset.pr;
  const noteId = form.dataset.note;

  if (action === "addPatientForm" && attId) {
    e.preventDefault();
    const attending = findAttending(attId);
    if (!attending) return;
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    if (!name) return;

    const patient = {
      id: uid("pt"),
      bed: String(fd.get("bed") || "").trim(),
      admitDate: String(fd.get("admitDate") || "").trim(),
      name,
      chartNo: String(fd.get("chartNo") || "").trim(),
      sex: String(fd.get("sex") || "").trim(),
      age: String(fd.get("age") || "").trim(),
      todos: [],
      status: [],
      antibiotics: [],
      problems: []
    };
    attending.patients.unshift(patient);
    expandedPatients.add(patient.id);
    expandedAddPatientAttendingId = null;
    saveState();
    form.reset();
    render();
    return;
  }

  if (action === "addTodoForm" && attId && pId) {
    e.preventDefault();
    const found = findPatient(attId, pId);
    if (!found || !found.patient) return;
    const fd = new FormData(form);
    const text = String(fd.get("text") || "").trim();
    if (!text) return;
    found.patient.todos.unshift(text);
    saveState();
    form.reset();
    render();
    return;
  }

  if (action === "editTodoForm" && attId && pId) {
    e.preventDefault();
    const idx = Number(form.dataset.idx);
    if (Number.isNaN(idx)) return;
    const found = findPatient(attId, pId);
    if (!found || !found.patient) return;
    const fd = new FormData(form);
    const text = String(fd.get("text") || "").trim();
    if (!text) return;
    if (!found.patient.todos[idx] && found.patient.todos[idx] !== "") return;
    found.patient.todos[idx] = text;
    editingTodo = null;
    saveState();
    render();
    return;
  }

  if (action === "addAbxItemForm" && attId && pId) {
    e.preventDefault();
    const found = findPatient(attId, pId);
    if (!found || !found.patient) return;
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const startDate = String(fd.get("startDate") || "").trim();
    const endDate = String(fd.get("endDate") || "").trim();
    const isOral = fd.get("isOral") === "on";
    if (!name) return;

    (found.patient.antibiotics ||= []).unshift({
      id: uid("abx"),
      name,
      startDate,
      endDate,
      isOral
    });
    saveState();
    form.reset();
    render();
    return;
  }

  if (action === "editAbxForm" && attId && pId) {
    e.preventDefault();
    const abxId = form.dataset.abx;
    const found = findPatient(attId, pId);
    if (!found || !found.patient || !abxId) return;
    const item = (found.patient.antibiotics || []).find((a) => a.id === abxId);
    if (!item) return;

    const fd = new FormData(form);
    item.name = String(fd.get("name") || "").trim();
    item.startDate = String(fd.get("startDate") || "").trim();
    item.endDate = String(fd.get("endDate") || "").trim();
    item.isOral = fd.get("isOral") === "on";

    editingAbxId = null;
    saveState();
    render();
    return;
  }

  if (action === "confirmDischargeForm" && attId && pId) {
    e.preventDefault();
    const found = findPatient(attId, pId);
    if (!found || !found.patient) return;
    const fd = new FormData(form);
    found.patient.dischargeDate = String(fd.get("date") || "").trim();
    dischargingPatientId = null;
    expandedPatients.delete(pId);
    saveState();
    render();
    return;
  }

  if (action === "addProblemForm" && attId && pId) {
    e.preventDefault();
    const found = findPatient(attId, pId);
    if (!found || !found.patient) return;
    const fd = new FormData(form);
    const title = String(fd.get("title") || "").trim();
    if (!title) return;
    found.patient.problems.unshift({
      id: uid("pr"),
      title,
      notes: []
    });
    saveState();
    form.reset();
    render();
    return;
  }

  if (action === "addNoteForm" && attId && pId && prId) {
    e.preventDefault();
    const found = findProblem(attId, pId, prId);
    if (!found || !found.problem) return;
    const fd = new FormData(form);
    const date = String(fd.get("date") || "").trim();
    const content = String(fd.get("content") || "").trim();
    if (!date || !content) return;
    const normalized = normalizeNotes(found.problem);
    normalized.unshift({
      id: uid("note"),
      date,
      content
    });
    found.problem.notes = sortNotesByDate(normalized);
    saveState();
    form.reset();
    render();
    return;
  }

  if (action === "addNoteSpecificForm" && attId && pId && prId) {
    e.preventDefault();
    const date = form.dataset.date;
    const found = findProblem(attId, pId, prId);
    if (!found || !found.problem || !date) return;
    const fd = new FormData(form);
    const content = String(fd.get("content") || "").trim();
    if (!content) return;

    const normalized = normalizeNotes(found.problem);
    normalized.push({
      id: uid("note"),
      date: date === "未指定日期" ? "" : date,
      content
    });
    found.problem.notes = sortNotesByDate(normalized);
    saveState();
    render();
    return;
  }

  if (action === "editNoteForm" && attId && pId && prId && noteId) {
    e.preventDefault();
    const found = findProblem(attId, pId, prId);
    if (!found || !found.problem) return;
    const fd = new FormData(form);
    const date = String(fd.get("date") || "").trim();
    const content = String(fd.get("content") || "").trim();
    if (!date || !content) return;
    const normalized = normalizeNotes(found.problem);
    const target = normalized.find((n) => n.id === noteId);
    if (!target) return;
    target.date = date;
    target.content = content;
    found.problem.notes = sortNotesByDate(normalized);
    editingNoteId = null;
    saveState();
    render();
    return;
  }

  if (action === "editPatientInfoForm" && attId && pId) {
    e.preventDefault();
    const found = findPatient(attId, pId);
    if (!found || !found.patient) return;
    const fd = new FormData(form);
    found.patient.name = String(fd.get("name") || "").trim();
    found.patient.bed = String(fd.get("bed") || "").trim();
    found.patient.admitDate = String(fd.get("admitDate") || "").trim();
    found.patient.chartNo = String(fd.get("chartNo") || "").trim();
    found.patient.sex = String(fd.get("sex") || "").trim();
    found.patient.age = String(fd.get("age") || "").trim();
    editingPatientInfoId = null;
    saveState();
    render();
    return;
  }

  if (action === "saveAttendingNameForm" && attId) {
    e.preventDefault();
    const attending = findAttending(attId);
    if (!attending) return;
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    if (name) {
      attending.name = name;
      editingAttendingId = null;
      saveState();
      render();
    }
    return;
  }
});

attendingSections.addEventListener("input", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLInputElement)) return;
  const action = target.dataset.action;
  if (action === "editAbxDate") {
    const field = target.dataset.field;
    const attId = target.dataset.att;
    const pId = target.dataset.p;
    const abxId = target.dataset.abx;
    if (!field || !attId || !pId || !abxId) return;
    if (!["startDate", "endDate"].includes(field)) return;
    const found = findPatient(attId, pId);
    if (!found || !found.patient) return;
    const item = (found.patient.antibiotics || []).find((a) => a.id === abxId);
    if (!item) return;
    item[field] = target.value;
    saveState();
    // no re-render on each keystroke/date picker interaction
    return;
  }

  if (action !== "editField") return;
  const field = target.dataset.field;
  const attId = target.dataset.att;
  const pId = target.dataset.p;
  if (!field || !attId || !pId) return;

  const found = findPatient(attId, pId);
  if (!found || !found.patient) return;

  if (!["bed", "admitDate", "name", "chartNo", "sex", "age"].includes(field)) return;
  found.patient[field] = target.value;
  saveState();
});

attendingSections.addEventListener(
  "change",
  (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    const action = target.dataset.action;
    if (action === "editAbxDate") {
      render();
      return;
    }
    if (action !== "editField") return;
    render();
  },
  true
);

exportBtn.addEventListener("click", () => {
  jsonOutput.value = JSON.stringify(state, null, 2);
  if (typeof jsonDialog.showModal === "function") jsonDialog.showModal();
  else alert(jsonOutput.value);
});

copyJsonBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(jsonOutput.value || "");
    copyJsonBtn.textContent = "已複製";
    setTimeout(() => {
      copyJsonBtn.textContent = "複製文字";
    }, 900);
  } catch {
    jsonOutput.focus();
    jsonOutput.select();
    document.execCommand("copy");
  }
});

downloadJsonBtn.addEventListener("click", () => {
  const content = jsonOutput.value;
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `patient_tracker_backup_${todayYmd()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

pasteImportBtn.addEventListener("click", () => {
  const text = jsonInputArea.value.trim();
  if (!text) return;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.attendings)) {
      alert("JSON 格式不正確：需要 { attendings: [...] }");
      return;
    }
    const ok = confirm("這將會覆蓋目前的資料，確定嗎？");
    if (!ok) return;
    state = { attendings: parsed.attendings };
    expandedPatients.clear();
    saveState();
    render();
    jsonInputArea.value = "";
    if (typeof jsonDialog.close === "function") jsonDialog.close();
  } catch {
    alert("解析文字失敗，請確保貼上的是完整的備份內容。");
  }
});

// Listeners for mode toggle and search are handled elsewhere or below

document.getElementById("modeToggleBtn").addEventListener("click", () => {
  isViewMode = !isViewMode;
  render();
});

render();
