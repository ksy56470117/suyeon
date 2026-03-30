```dataviewjs
// ── 열품타 (Study Timer) ──
// 모든 공부 기록은 Day Planners/ 파일에 저장됩니다.
// localStorage는 현재 타이머 상태(진행중 여부)만 임시 보관합니다.

const container = this.container;
container.empty();

const TIMER_KEY = "obsidian-timer-state";
const TODAY = new Date().toISOString().slice(0, 10);

// ── 타이머 상태 (현재 세션만, 기록X) ──
function loadTimer() {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    return raw ? JSON.parse(raw) : { running: false, startTime: null, subject: "" };
  } catch { return { running: false, startTime: null, subject: "" }; }
}
function saveTimer(s) { localStorage.setItem(TIMER_KEY, JSON.stringify(s)); }

// ── Day Planner 파일 경로 ──
function dpPath(dateStr) {
  return `Day Planners/Day Planner-${dateStr.replace(/-/g, "")}.md`;
}

// ── Day Planner에서 공부 기록 읽기 ──
async function readDPEntries(dateStr) {
  const file = app.vault.getAbstractFileByPath(dpPath(dateStr));
  if (!file) return [];
  const content = await app.vault.read(file);
  const lines = content.split("\n");
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^- \[(x| )\] (\d{1,2}:\d{2}(?::\d{2})?)\s+(.+?)(?:\s+\((.+?)\))?\s*$/);
    if (!m) continue;
    const startTime = m[2];
    const subject = m[3];
    if (subject === "END" || subject === "BREAK") continue;
    // 다음 항목에서 종료시간 찾기
    let endTime = "";
    let secs = 0;
    function timeToSecs(t) {
      const p = t.split(":").map(Number);
      return p[0] * 3600 + p[1] * 60 + (p[2] || 0);
    }
    for (let j = i + 1; j < lines.length; j++) {
      const nm = lines[j].match(/^- \[.\] (\d{1,2}:\d{2}(?::\d{2})?)\s/);
      if (nm) {
        endTime = nm[1];
        secs = timeToSecs(endTime) - timeToSecs(startTime);
        break;
      }
    }
    if (secs > 0) entries.push({ subject, start: startTime, end: endTime, seconds: secs });
  }
  return entries;
}

// ── Day Planner에서 총 초 계산 ──
async function getDPTotalSeconds(dateStr) {
  const entries = await readDPEntries(dateStr);
  return entries.reduce((a, e) => a + e.seconds, 0);
}

// ── Day Planner에 기록 쓰기 ──
async function writeToDayPlanner(startDate, endDate, subject, elapsed) {
  const y = startDate.getFullYear();
  const mm = String(startDate.getMonth() + 1).padStart(2, "0");
  const dd = String(startDate.getDate()).padStart(2, "0");
  const path = `Day Planners/Day Planner-${y}${mm}${dd}.md`;
  const startStr = fmtClock(startDate);
  const endStr = fmtClock(endDate);
  const line = `- [x] ${startStr} ${subject} (${fmtHMS(elapsed)})`;
  const endLine = `- [ ] ${endStr} END`;

  let file = app.vault.getAbstractFileByPath(path);
  if (file) {
    let content = await app.vault.read(file);
    // 마지막 END 줄 제거 후 새 항목 추가
    const lines = content.trimEnd().split("\n");
    const lastEnd = lines.findLastIndex(l => /^- \[.\] \d{1,2}:\d{2}(?::\d{2})?\s+END/.test(l));
    if (lastEnd >= 0) lines.splice(lastEnd, 1);
    const newContent = lines.join("\n") + "\n" + line + "\n" + endLine + "\n";
    await app.vault.modify(file, newContent);
  } else {
    await app.vault.create(path, "## Day Planner\n" + line + "\n" + endLine + "\n");
  }
}

// ── 유틸 ──
function fmtTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function fmtHMS(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
function fmtClock(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

// ── 과목 목록 (모든 폴더명) ──
const subjects = [
  "26-1","4차산업혁명과창의융합SW","SW리더십과기업가정신",
  "국가안보론","네트워크보안","북한학",
  "신화·상상력·문화","한국의문화유산역사여행",
  "CPA","01_회계","02_세법","03_경제학",
  "04_경영학","일반경영","재무관리",
  "05_기업법","01_기업법1","02_기업법2"
];

let timerState = loadTimer();
let interval = null;

// 읽기모드 해제 방지
function stopEdit(el) {
  el.addEventListener("mousedown", e => e.stopPropagation());
  el.addEventListener("click", e => e.stopPropagation());
  return el;
}

// ══════════════════════════════════════
// ── UI 렌더링 ──
// ══════════════════════════════════════
async function render() {
  container.empty();
  timerState = loadTimer();

  const wrapper = container.createEl("div", { cls: "timer-container" });
  stopEdit(wrapper);

  // ── Header ──
  const header = wrapper.createEl("div", { cls: "timer-header" });
  header.createEl("span", { text: "⏱", cls: "icon" });
  header.createEl("span", { text: "열품타" });

  const elapsed = timerState.running
    ? Math.floor((Date.now() - timerState.startTime) / 1000)
    : 0;

  // ── Timer Display ──
  const display = wrapper.createEl("div", { cls: "timer-display" });
  display.id = "timer-display";
  display.textContent = fmtTime(elapsed);

  // ── Subject ──
  const subjectDiv = wrapper.createEl("div", { cls: "timer-subject" });
  if (timerState.running && timerState.subject) {
    subjectDiv.textContent = "📖 " + timerState.subject;
  } else if (!timerState.running) {
    const select = subjectDiv.createEl("select", {
      attr: { style: "padding: 4px 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary); color: var(--text-normal); font-size: 14px; cursor: pointer;" }
    });
    for (const s of subjects) {
      const opt = select.createEl("option", { text: s, value: s });
      if (timerState.subject === s) opt.selected = true;
    }
    select.createEl("option", { text: "직접 입력...", value: "__custom__" });
    select.addEventListener("change", () => {
      if (select.value === "__custom__") {
        const custom = prompt("과목명을 입력하세요:");
        if (custom) { timerState.subject = custom; }
        else { select.value = subjects[0]; timerState.subject = subjects[0]; }
      } else { timerState.subject = select.value; }
      saveTimer(timerState);
    });
    if (!timerState.subject) { timerState.subject = subjects[0]; saveTimer(timerState); }
  }

  // ── Buttons ──
  const actions = wrapper.createEl("div", { cls: "timer-actions" });

  if (!timerState.running) {
    const startBtn = actions.createEl("button", { cls: "timer-btn timer-btn-start", text: "▶  시작" });
    startBtn.addEventListener("click", () => {
      timerState.running = true;
      timerState.startTime = Date.now();
      saveTimer(timerState);
      render();
      startTick();
    });
  } else {
    const stopBtn = actions.createEl("button", { cls: "timer-btn timer-btn-stop", text: "⏹  정지" });
    stopBtn.addEventListener("click", async () => {
      const secs = Math.floor((Date.now() - timerState.startTime) / 1000);
      const subj = timerState.subject || "자율 공부";
      if (secs > 0) {
        await writeToDayPlanner(new Date(timerState.startTime), new Date(), subj, secs);
      }
      timerState.running = false;
      timerState.startTime = null;
      saveTimer(timerState);
      if (interval) { clearInterval(interval); interval = null; }
      render();
    });
  }

  // ── 오늘 공부 기록 (Day Planner에서 읽기) ──
  const todayEntries = await readDPEntries(TODAY);

  if (todayEntries.length > 0) {
    const logHeader = wrapper.createEl("div", { cls: "timer-header", attr: { style: "border-top: 1px solid var(--background-modifier-border);" } });
    logHeader.createEl("span", { text: "📝", cls: "icon" });
    logHeader.createEl("span", { text: "오늘 공부 기록" });

    const logList = wrapper.createEl("div", { cls: "timer-log" });
    for (const entry of todayEntries) {
      const item = logList.createEl("div", { cls: "timer-log-item" });
      item.createEl("div", { cls: "timer-log-dot" });
      item.createEl("span", { text: entry.subject });
      const ts = item.createEl("span", { text: `${entry.start}~${entry.end}` });
      ts.style.cssText = "color: var(--text-muted); font-size: 12px; margin-left: auto;";
      item.createEl("span", { cls: "timer-log-time", text: fmtHMS(entry.seconds) });
    }

    const totalSecs = todayEntries.reduce((a, e) => a + e.seconds, 0);
    const totalDiv = wrapper.createEl("div", { cls: "timer-total" });
    totalDiv.createEl("span", { text: "오늘 총 공부 시간" });
    totalDiv.createEl("span", { cls: "timer-total-value", text: fmtHMS(totalSecs) });
  }

  // ── 과목별 통계 (오늘) ──
  if (todayEntries.length > 0) {
    const subjMap = {};
    for (const e of todayEntries) {
      subjMap[e.subject] = (subjMap[e.subject] || 0) + e.seconds;
    }
    const subjArr = Object.entries(subjMap).sort((a, b) => b[1] - a[1]);
    const totalSecs = todayEntries.reduce((a, e) => a + e.seconds, 0);

    const statHeader = wrapper.createEl("div", { cls: "timer-header", attr: { style: "border-top: 1px solid var(--background-modifier-border);" } });
    statHeader.createEl("span", { text: "📊", cls: "icon" });
    statHeader.createEl("span", { text: "과목별 통계" });

    const statColors = {
      "26-1":"#2DA44E","4차산업혁명과창의융합SW":"#3B82F6","SW리더십과기업가정신":"#6366F1",
      "국가안보론":"#D73A4A","네트워크보안":"#E36209","북한학":"#0E8A16",
      "신화·상상력·문화":"#A78BFA","한국의문화유산역사여행":"#F59E0B",
      "CPA":"#F97316","01_회계":"#3B82F6","02_세법":"#F59E0B","03_경제학":"#14B8A6",
      "04_경영학":"#E36209","일반경영":"#FB923C","재무관리":"#F472B6",
      "05_기업법":"#6366F1","01_기업법1":"#818CF8","02_기업법2":"#A78BFA"
    };
    function getStatColor(name) { return statColors[name] || "#2DA44E"; }

    const statList = wrapper.createEl("div", { attr: { style: "padding: 4px 14px 8px;" } });
    for (const [subj, secs] of subjArr) {
      const pct = Math.round((secs / totalSecs) * 100);
      const c = getStatColor(subj);

      const row = statList.createEl("div", { attr: { style: "display: flex; align-items: center; gap: 8px; margin-bottom: 8px;" } });
      // 과목명 + 컬러칩
      const nameChip = row.createEl("span", { attr: { style: `display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; min-width: 120px; font-family: 'SF Mono', ui-monospace, monospace;` } });
      nameChip.createEl("span", { text: "●", attr: { style: `color: ${c}; font-size: 10px;` } });
      nameChip.createEl("span", { text: subj });

      // 프로그레스 바
      const barBg = row.createEl("div", { attr: { style: "flex: 1; height: 8px; background: var(--background-modifier-border); border-radius: 4px; overflow: hidden;" } });
      barBg.createEl("div", { attr: { style: `width: ${pct}%; height: 100%; background: ${c}; border-radius: 4px;` } });

      // 시간 + 퍼센트
      row.createEl("span", { text: `${fmtHMS(secs)} (${pct}%)`, attr: { style: "font-size: 11px; color: var(--text-muted); white-space: nowrap; min-width: 80px; text-align: right; font-family: 'SF Mono', ui-monospace, monospace;" } });
    }
  }

  // ── GitHub 잔디 히트맵 (Day Planner 파일 기반) ──
  try {
    const WEEKS = 16;
    const TOTAL_DAYS = WEEKS * 7;
    const now = new Date();
    const todayDow = now.getDay();
    const endOffset = 6 - todayDow;
    const allDays = [];

    for (let i = TOTAL_DAYS - 1 + endOffset; i >= -endOffset; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const total = await getDPTotalSeconds(key);
      allDays.push({ date: key, total, dow: d.getDay() });
    }

    while (allDays.length > 0 && allDays[0].dow !== 0) allDays.shift();
    while (allDays.length % 7 !== 0) allDays.pop();

    const weeks = [];
    for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7));

    function contribLevel(secs) {
      if (secs === 0) return 0;
      if (secs < 1800) return 1;
      if (secs < 3600) return 2;
      if (secs < 7200) return 3;
      return 4;
    }
    const colors = ["var(--background-modifier-border)","rgba(45,164,78,0.3)","rgba(45,164,78,0.55)","rgba(45,164,78,0.8)","#2DA44E"];

    const heatHeader = wrapper.createEl("div", { cls: "timer-header", attr: { style: "border-top: 1px solid var(--background-modifier-border);" } });
    heatHeader.createEl("span", { text: "🌱", cls: "icon" });
    heatHeader.createEl("span", { text: "공부 잔디" });

    const studyDays = allDays.filter(d => d.total > 0).length;
    const totalAll = allDays.reduce((a, d) => a + d.total, 0);
    heatHeader.createEl("span", {
      text: `${studyDays}일`,
      attr: { style: "margin-left: auto; font-size: 11px; font-weight: 600; color: #2DA44E; background: rgba(45,164,78,0.1); padding: 2px 8px; border-radius: 10px;" }
    });

    // 월 라벨
    const monthRow = wrapper.createEl("div", { attr: { style: "display: flex; padding: 8px 14px 0 38px; gap: 0;" } });
    let lastMonth = -1;
    for (const week of weeks) {
      const m = new Date(week[0].date).getMonth();
      const label = monthRow.createEl("div", { attr: { style: "width: 13px; font-size: 9px; color: var(--text-faint);" } });
      if (m !== lastMonth) {
        label.textContent = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"][m];
        label.style.width = "auto";
        label.style.paddingRight = "4px";
        lastMonth = m;
      }
    }

    // 그리드
    const grid = wrapper.createEl("div", { attr: { style: "display: flex; gap: 3px; padding: 4px 14px 8px; overflow-x: auto;" } });
    const dayLabels = grid.createEl("div", { attr: { style: "display: flex; flex-direction: column; gap: 3px; padding-right: 4px;" } });
    for (const name of ["", "월", "", "수", "", "금", ""]) {
      dayLabels.createEl("div", { text: name, attr: { style: "width: 20px; height: 11px; font-size: 9px; color: var(--text-faint); line-height: 11px;" } });
    }

    for (const week of weeks) {
      const col = grid.createEl("div", { attr: { style: "display: flex; flex-direction: column; gap: 3px;" } });
      for (const day of week) {
        const lv = contribLevel(day.total);
        const isToday = day.date === TODAY;
        col.createEl("div", {
          attr: {
            style: `width: 11px; height: 11px; border-radius: 2px; background: ${colors[lv]};${isToday ? " outline: 2px solid #2DA44E; outline-offset: -1px;" : ""}`,
            title: `${day.date}: ${day.total > 0 ? fmtHMS(day.total) : "기록 없음"}`
          }
        });
      }
    }

    // 범례
    const legend = wrapper.createEl("div", { attr: { style: "display: flex; align-items: center; justify-content: flex-end; gap: 4px; padding: 0 14px 10px;" } });
    legend.createEl("span", { text: "Less", attr: { style: "font-size: 9px; color: var(--text-faint);" } });
    for (let i = 0; i <= 4; i++) legend.createEl("div", { attr: { style: `width: 10px; height: 10px; border-radius: 2px; background: ${colors[i]};` } });
    legend.createEl("span", { text: "More", attr: { style: "font-size: 9px; color: var(--text-faint);" } });

    if (totalAll > 0) {
      const bar = wrapper.createEl("div", { cls: "timer-total" });
      bar.createEl("span", { text: `최근 ${WEEKS}주 총 공부` });
      bar.createEl("span", { cls: "timer-total-value", text: fmtHMS(totalAll) });
    }

    // ── 전체 기간 과목별 통계 ──
    const allSubjMap = {};
    for (const day of allDays) {
      if (day.total === 0) continue;
      const entries = await readDPEntries(day.date);
      for (const e of entries) {
        allSubjMap[e.subject] = (allSubjMap[e.subject] || 0) + e.seconds;
      }
    }
    const allSubjArr = Object.entries(allSubjMap).sort((a, b) => b[1] - a[1]);

    if (allSubjArr.length > 0) {
      const aStatHeader = wrapper.createEl("div", { cls: "timer-header", attr: { style: "border-top: 1px solid var(--background-modifier-border);" } });
      aStatHeader.createEl("span", { text: "📈", cls: "icon" });
      aStatHeader.createEl("span", { text: `최근 ${WEEKS}주 과목별` });

      const statColors = {
        "26-1":"#2DA44E","4차산업혁명과창의융합SW":"#3B82F6","SW리더십과기업가정신":"#6366F1",
        "국가안보론":"#D73A4A","네트워크보안":"#E36209","북한학":"#0E8A16",
        "신화·상상력·문화":"#A78BFA","한국의문화유산역사여행":"#F59E0B",
        "CPA":"#F97316","01_회계":"#3B82F6","02_세법":"#F59E0B","03_경제학":"#14B8A6",
        "04_경영학":"#E36209","일반경영":"#FB923C","재무관리":"#F472B6",
        "05_기업법":"#6366F1","01_기업법1":"#818CF8","02_기업법2":"#A78BFA"
      };
      function getAllStatColor(name) { return statColors[name] || "#2DA44E"; }

      const aStatList = wrapper.createEl("div", { attr: { style: "padding: 4px 14px 8px;" } });
      for (const [subj, secs] of allSubjArr) {
        const pct = Math.round((secs / totalAll) * 100);
        const c = getAllStatColor(subj);

        const row = aStatList.createEl("div", { attr: { style: "display: flex; align-items: center; gap: 8px; margin-bottom: 8px;" } });
        const nameChip = row.createEl("span", { attr: { style: `display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; min-width: 120px; font-family: 'SF Mono', ui-monospace, monospace;` } });
        nameChip.createEl("span", { text: "●", attr: { style: `color: ${c}; font-size: 10px;` } });
        nameChip.createEl("span", { text: subj });

        const barBg = row.createEl("div", { attr: { style: "flex: 1; height: 8px; background: var(--background-modifier-border); border-radius: 4px; overflow: hidden;" } });
        barBg.createEl("div", { attr: { style: `width: ${pct}%; height: 100%; background: ${c}; border-radius: 4px;` } });

        row.createEl("span", { text: `${fmtHMS(secs)} (${pct}%)`, attr: { style: "font-size: 11px; color: var(--text-muted); white-space: nowrap; min-width: 80px; text-align: right; font-family: 'SF Mono', ui-monospace, monospace;" } });
      }
    }
  } catch {}

  if (timerState.running) startTick();
}

function startTick() {
  if (interval) clearInterval(interval);
  interval = setInterval(() => {
    const el = document.getElementById("timer-display");
    if (!el) { clearInterval(interval); interval = null; return; }
    const st = loadTimer();
    if (!st.running) { clearInterval(interval); interval = null; return; }
    el.textContent = fmtTime(Math.floor((Date.now() - st.startTime) / 1000));
  }, 1000);
}

render();
```
