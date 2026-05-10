const STORAGE_KEY = "patientTrackerStandaloneV1";

/**
 * antibiotic item:
 * - name
 * - startDate
 * - endDate
 */

/** @typedef {{ id: string, name: string, startDate: string, endDate: string }} AntibioticItem */
/** @typedef {{ id: string, date: string, content: string }} NoteItem */
/** @typedef {{ id: string, title: string, notes: NoteItem[] | string[] }} Problem */
/** @typedef {{ id: string, bed: string, admitDate: string, name: string, chartNo: string, sex: string, age: string, todos: string[], antibiotics: AntibioticItem[], problems: Problem[], dischargeDate?: string }} Patient */
/** @typedef {{ id: string, name: string, patients: Patient[] }} Attending */
/** @typedef {{ attendings: Attending[] }} TrackerState */

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
const importFile = document.getElementById("importFile");
const resetBtn = document.getElementById("resetBtn");
const jsonDialog = document.getElementById("jsonDialog");
const jsonOutput = document.getElementById("jsonOutput");
const copyJsonBtn = document.getElementById("copyJsonBtn");

if (
  !attendingSections ||
  !emptyState ||
  !addAttendingForm ||
  !searchInput ||
  !exportBtn ||
  !importFile ||
  !resetBtn ||
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
let dischargingPatientId = null;

/** @type {boolean} */
let isViewMode = true;

/** @type {boolean} */
let isAddAttendingVisible = false;

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
          <form class="row" data-action="editTodoForm" data-att="${att.id}" data-p="${p.id}" data-idx="${idx}">
            <input name="text" value="${escapeHtml(t)}" autocomplete="off" required />
            <button type="submit">儲存</button>
            <button type="button" class="mini-ghost" data-action="cancelEditTodo">取消</button>
            <button type="button" class="mini-danger" data-action="delTodo" data-att="${att.id}" data-p="${p.id}" data-idx="${idx}">刪除</button>
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
          <form class="row" data-action="editAbxForm" data-att="${att.id}" data-p="${p.id}" data-abx="${a.id}">
            <input name="name" list="abxList" value="${escapeHtml(a.name)}" required />
            <input name="startDate" type="date" value="${escapeHtml(a.startDate || "")}" />
            <input name="endDate" type="date" value="${escapeHtml(a.endDate || "")}" />
            <button type="submit">儲存</button>
            <button type="button" class="mini-ghost" data-action="cancelEditAbx">取消</button>
            <button type="button" class="mini-danger" data-action="delAbxItem" data-att="${att.id}" data-p="${p.id}" data-abx="${a.id}">刪除</button>
          </form>
        `;
      }

      const start = formatDateShort(a.startDate);
      const end = formatDateShort(a.endDate);
      return `
        <div class="row ${cls}">
          <div class="row-main abx-name ${isViewMode ? "" : "clickable"}" ${
        isViewMode ? "" : `data-action="startEditAbx" data-abx="${a.id}"`
      }>${escapeHtml(a.name)}(${escapeHtml(start)}-${escapeHtml(end)})</div>
        </div>
      `;
    })
    .join("");

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
                  <form class="row" data-action="editNoteForm" data-att="${att.id}" data-p="${p.id}" data-pr="${pr.id}" data-note="${n.id}">
                    <input name="date" type="date" value="${escapeHtml(n.date || "")}" required />
                    <input name="content" value="${escapeHtml(n.content)}" autocomplete="off" required />
                    <button type="submit">儲存</button>
                    <button type="button" class="mini-ghost" data-action="cancelEditNote">取消</button>
                    <button type="button" class="mini-danger" data-action="delNote" data-att="${att.id}" data-p="${p.id}" data-pr="${pr.id}" data-note="${n.id}">刪除</button>
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
                  <input name="content" placeholder="在此日期新增 note..." autocomplete="off" required />
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
                : `<button type="button" class="mini-danger" data-action="delProblem" data-att="${att.id}" data-p="${p.id}" data-pr="${pr.id}">刪除</button>`
            }
          </div>
          <div class="notes">
            ${notesHtml || `<div class="patient-meta">尚無 notes</div>`}
          </div>
          ${
            isViewMode
              ? ""
              : `
          <form class="inline" data-action="addNoteForm" data-att="${att.id}" data-p="${p.id}" data-pr="${pr.id}">
            <input name="date" type="date" required />
            <input name="content" placeholder="新增 note..." autocomplete="off" required />
            <button type="submit">新增 note</button>
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
        : `<button type="button" class="mini-ghost" data-action="startEditPatientInfo" data-p="${p.id}">🖊️ 編輯資料</button>`
    }
    ${
      p.dischargeDate
        ? `<button type="button" class="mini-ghost" data-action="reActivatePatient" data-att="${att.id}" data-p="${p.id}">恢復住院</button>`
        : `<button type="button" class="mini-ghost" data-action="startDischarge" data-p="${p.id}">出院</button>`
    }
    <button type="button" class="mini-danger" data-action="delPatient" data-att="${att.id}" data-p="${p.id}">刪除病人</button>
  `;

  return `
    <article class="patient ${isViewMode ? "view-mode-patient" : ""}" data-att="${att.id}" data-p="${p.id}">
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
      ${
        isOpen
          ? `
        <div class="patient-details">
          <div class="attending-actions">
            ${editActions}
          </div>

          ${
            !isViewMode && dischargingPatientId === p.id
              ? `
            <form class="discharge-form" data-action="confirmDischargeForm" data-att="${att.id}" data-p="${p.id}">
              <label><span>出院日期</span><input name="date" type="date" value="${todayYmd()}" required /></label>
              <button type="submit">確認出院</button>
              <button type="button" class="mini-ghost" data-action="cancelDischarge">取消</button>
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
                <button type="submit">儲存</button>
                <button type="button" class="mini-ghost" data-action="cancelEditPatientInfo">取消</button>
              </div>
            </form>
          `
              : ""
          }

          ${
            p.todos.length > 0 || !isViewMode
              ? `
          <div>
            <div class="section-title">Todos</div>
            <div class="list">${todosHtml || `<span class="patient-meta">尚無 todos</span>`}</div>
            ${
              isViewMode
                ? ""
                : `
            <form class="inline" data-action="addTodoForm" data-att="${att.id}" data-p="${p.id}">
              <input name="text" placeholder="新增 todo..." autocomplete="off" />
              <button type="submit">新增</button>
            </form>
            `
            }
          </div>
          `
              : ""
          }

          ${
            (p.antibiotics || []).length > 0 || !isViewMode
              ? `
          <div>
            <div class="section-title">Antibiotics</div>
            <div class="list">${abxHtml || `<span class="patient-meta">尚無 antibiotics</span>`}</div>
            ${
              isViewMode
                ? ""
                : `
            <form class="inline" data-action="addAbxItemForm" data-att="${att.id}" data-p="${p.id}">
              <input name="name" list="abxList" placeholder="選擇或輸入抗生素名稱..." autocomplete="off" />
              <input name="startDate" type="date" />
              <input name="endDate" type="date" />
              <button type="submit">新增</button>
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
            <div class="section-title">Problems</div>
            <div class="notes">${problemsHtml || `<div class="patient-meta">尚無 problems</div>`}</div>
            ${
              isViewMode
                ? ""
                : `
            <form class="inline" data-action="addProblemForm" data-att="${att.id}" data-p="${p.id}">
              <input name="title" placeholder="新增 problem title..." autocomplete="off" />
              <button type="submit">新增 problem</button>
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
                  <h3>${escapeHtml(att.name || "(未命名 attending)")}</h3>
                </div>
                <div class="attending-actions">
                  ${
                    isViewMode
                      ? ""
                      : `
                  <button type="button" class="mini-ghost" data-action="toggleAddPatientForm" data-att="${att.id}">
                    ${expandedAddPatientAttendingId === att.id ? "取消新增" : "新增病人"}
                  </button>
                  <button type="button" class="mini-danger" data-action="delAttending" data-att="${att.id}">刪除</button>
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
                  <button type="submit">確認新增</button>
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
    if (!name) return;

    (found.patient.antibiotics ||= []).unshift({
      id: uid("abx"),
      name,
      startDate,
      endDate
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

importFile.addEventListener("change", async () => {
  const file = importFile.files && importFile.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.attendings)) {
      alert("JSON 格式不正確：需要 { attendings: [...] }");
      return;
    }
    state = { attendings: parsed.attendings };
    expandedPatients.clear();
    saveState();
    render();
  } catch {
    alert("讀取或解析 JSON 失敗。");
  } finally {
    importFile.value = "";
  }
});

resetBtn.addEventListener("click", () => {
  const ok = confirm("確定清空所有資料？（localStorage 將被刪除）");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  state = { attendings: [] };
  expandedPatients.clear();
  render();
});

document.getElementById("modeToggleBtn").addEventListener("click", () => {
  isViewMode = !isViewMode;
  render();
});

render();
