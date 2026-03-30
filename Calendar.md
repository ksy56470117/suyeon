---
cssclass: taskflow-card
color: var(--mk-color-purple)
---

```dataviewjs
const container = this.container;
container.empty();
container.addEventListener("mousedown", e => e.stopPropagation());
container.addEventListener("click", e => e.stopPropagation());

// ── State ──
const STATE_KEY = "obsidian-cal-state";
// 로컬 시간 기준 YYYY-MM-DD
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function loadCalState() {
  try {
    const r = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
    return {
      month: r.month ?? new Date().getMonth(),
      year: r.year ?? new Date().getFullYear(),
      selDate: r.selDate ?? localDateStr(new Date())
    };
  } catch { return { month: new Date().getMonth(), year: new Date().getFullYear(), selDate: localDateStr(new Date()) }; }
}
function saveCalState(s) { localStorage.setItem(STATE_KEY, JSON.stringify(s)); }

let cs = loadCalState();
const TODAY = localDateStr(new Date());

// ── 전체 태스크 수집 ──
const allTasks = [];
for (const page of dv.pages()) {
  for (const t of page.file.tasks) {
    if (!t.text.trim()) continue;
    let dueDate = null;
    if (t.due) {
      dueDate = t.due.toString().slice(0,10);
    } else {
      const fm = page.file.name.match(/^(\d{4}-\d{2}-\d{2})$/);
      if (fm) dueDate = fm[1];
    }
    const folder = page.file.folder;
    let tag = "";
    if (folder && folder !== "Daily" && folder !== "Templates" && folder !== "Day Planners") {
      const parts = folder.split("/");
      tag = parts[parts.length - 1];
    }
    // 태그 추출: %%tag:...%% → #태그 → 폴더 순
    if (!tag) {
      const metaTag = t.text.match(/%%tag:(.+?)%%/);
      if (metaTag) tag = metaTag[1];
    }
    if (!tag) {
      const inlineTag = t.text.match(/#(\S+)/);
      if (inlineTag) tag = inlineTag[1].replace(/_/g, " ");
    }
    allTasks.push({
      text: t.text.replace(/%%tag:.+?%%/g,"").replace(/📅\s*\d{4}-\d{2}-\d{2}/g,"").replace(/[🔁⏫🔼🔽].*$/g,"").replace(/#\S+/g,"").replace(/\d{4}-\d{2}-\d{2}/g,"").trim(),
      rawText: t.text,
      completed: t.completed,
      due: dueDate,
      tag,
      path: page.file.path,
      line: t.line
    });
  }
}

// 날짜별 그룹
function tasksForDate(dateStr) {
  return allTasks.filter(t => t.due === dateStr);
}

// contribution level
function contribLevel(count) {
  if (count === 0) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}
const contribColors = ["transparent","rgba(45,164,78,0.3)","rgba(45,164,78,0.55)","rgba(45,164,78,0.8)","#2DA44E"];

// 태그 색상 (모든 폴더)
const tagColors = {
  // 26-1
  "26-1":"#2DA44E",
  "4차산업혁명과창의융합SW":"#3B82F6",
  "SW리더십과기업가정신":"#6366F1",
  "국가안보론":"#D73A4A",
  "네트워크보안":"#E36209",
  "북한학":"#0E8A16",
  "신화·상상력·문화":"#A78BFA",
  "한국의문화유산역사여행":"#F59E0B",
  // CPA
  "CPA":"#F97316",
  "01_회계":"#3B82F6",
  "02_세법":"#F59E0B",
  "03_경제학":"#14B8A6",
  "04_경영학":"#E36209",
  "일반경영":"#FB923C",
  "재무관리":"#F472B6",
  "05_기업법":"#6366F1",
  "01_기업법1":"#818CF8",
  "02_기업법2":"#A78BFA",
};
function getTagColor(tag) { return tagColors[tag] || "#8E8E93"; }

// ── 캘린더 날짜 생성 ──
function generateDays(year, month) {
  const first = new Date(year, month, 1);
  const startDow = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  // 이전 달
  const prevDays = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevDays - i);
    days.push({ date: d, key: localDateStr(d), current: false });
  }
  // 이번 달
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    days.push({ date: d, key: localDateStr(d), current: true });
  }
  // 다음 달 (6주 채우기)
  while (days.length < 42) {
    const d = new Date(year, month + 1, days.length - startDow - daysInMonth + 1);
    days.push({ date: d, key: localDateStr(d), current: false });
  }
  return days;
}

// ══════════════════════════
// ── 렌더링 ──
// ══════════════════════════
async function render() {
  container.empty();
  cs = loadCalState();
  const wrapper = container.createEl("div", { attr: { style: "max-width: 900px; margin: 0 auto;" } });
  wrapper.addEventListener("mousedown", e => e.stopPropagation());

  // ── Calendar Card ──
  const card = wrapper.createEl("div", { attr: { style: "border: 1px solid var(--background-modifier-border); border-radius: 8px; overflow: hidden; background: var(--background-primary); margin: 8px 16px;" } });

  // Header
  const hdr = card.createEl("div", { attr: { style: "display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--background-secondary-alt);" } });
  hdr.createEl("span", { text: "📅", attr: { style: "font-size: 14px;" } });
  hdr.createEl("span", { text: `${cs.year}년 ${cs.month + 1}월`, attr: { style: "font-size: 15px; font-weight: 700; font-family: 'SF Mono', ui-monospace, monospace;" } });
  hdr.createEl("span", { attr: { style: "flex:1;" } });

  // Nav buttons
  const nav = hdr.createEl("div", { attr: { style: "display: flex; gap: 2px;" } });
  const btnStyle = "padding: 4px 10px; border-radius: 6px; border: none; background: var(--background-modifier-border); color: var(--text-muted); cursor: pointer; font-size: 12px; font-weight: 600;";

  const prevBtn = nav.createEl("button", { text: "‹", attr: { style: btnStyle } });
  prevBtn.addEventListener("click", () => {
    cs.month--;
    if (cs.month < 0) { cs.month = 11; cs.year--; }
    saveCalState(cs); render();
  });

  const todayBtn = nav.createEl("button", { text: "Today", attr: { style: btnStyle } });
  todayBtn.addEventListener("click", () => {
    const now = new Date();
    cs.month = now.getMonth(); cs.year = now.getFullYear(); cs.selDate = TODAY;
    saveCalState(cs); render();
  });

  const nextBtn = nav.createEl("button", { text: "›", attr: { style: btnStyle } });
  nextBtn.addEventListener("click", () => {
    cs.month++;
    if (cs.month > 11) { cs.month = 0; cs.year++; }
    saveCalState(cs); render();
  });

  // Weekday header
  const weekRow = card.createEl("div", { attr: { style: "display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--background-modifier-border);" } });
  for (const d of ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]) {
    weekRow.createEl("div", { text: d, attr: { style: "text-align: center; padding: 6px 0; font-size: 11px; font-weight: 600; color: var(--text-muted); font-family: 'SF Mono', ui-monospace, monospace;" } });
  }

  // Calendar grid
  const days = generateDays(cs.year, cs.month);
  const grid = card.createEl("div", { attr: { style: "display: grid; grid-template-columns: repeat(7, 1fr);" } });

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const tasks = tasksForDate(day.key);
    const isToday = day.key === TODAY;
    const isSel = day.key === cs.selDate;
    const level = contribLevel(tasks.length);

    const cell = grid.createEl("div", { attr: {
      style: `min-height: 80px; padding: 2px; border-right: ${(i % 7 < 6) ? "1px solid var(--background-modifier-border-hover)" : "none"}; border-bottom: 1px solid var(--background-modifier-border-hover); cursor: pointer; ${isSel ? "background: var(--background-secondary);" : ""}`
    }});

    cell.addEventListener("click", (e) => {
      e.stopPropagation();
      cs.selDate = day.key;
      saveCalState(cs);
      render();
    });

    // 날짜 숫자 + contribution dot
    const numRow = cell.createEl("div", { attr: { style: "display: flex; align-items: center; gap: 3px; padding: 2px 3px;" } });

    const numStyle = isToday
      ? "font-size: 11px; font-weight: 700; color: white; background: #2DA44E; border-radius: 4px; width: 20px; height: 18px; display: flex; align-items: center; justify-content: center; font-family: 'SF Mono', ui-monospace, monospace;"
      : `font-size: 11px; font-weight: ${isSel ? "700" : "500"}; color: ${day.current ? "var(--text-normal)" : "var(--text-faint)"}; width: 20px; height: 18px; display: flex; align-items: center; justify-content: center; font-family: 'SF Mono', ui-monospace, monospace;${isSel ? " border: 1.5px solid #2DA44E; border-radius: 4px;" : ""}`;

    numRow.createEl("div", { text: String(day.date.getDate()), attr: { style: numStyle } });

    if (level > 0 && day.current) {
      numRow.createEl("div", { attr: { style: `width: 8px; height: 8px; border-radius: 2px; background: ${contribColors[level]};` } });
    }

    // 태스크 칩 (최대 4개)
    const maxChips = 4;
    const shown = tasks.slice(0, maxChips);
    for (const t of shown) {
      const color = getTagColor(t.tag);
      const chip = cell.createEl("div", { attr: {
        style: `display: flex; align-items: stretch; gap: 2px; margin: 1px 2px; padding: 1px 3px; background: ${color}12; border-radius: 2px; overflow: hidden;`
      }});
      chip.createEl("div", { attr: { style: `width: 2px; background: ${color}; border-radius: 1px; flex-shrink: 0;` } });
      const chipText = chip.createEl("span", { text: t.text, attr: {
        style: `font-size: 9px; line-height: 1.3; color: ${day.current ? "var(--text-normal)" : "var(--text-faint)"}; ${t.completed ? "text-decoration: line-through; opacity: 0.5;" : ""} font-family: 'SF Mono', ui-monospace, monospace; overflow: hidden;`
      }});
    }
    if (tasks.length > maxChips) {
      cell.createEl("div", { text: `+${tasks.length - maxChips}`, attr: { style: "font-size: 8px; color: var(--text-faint); padding-left: 5px;" } });
    }
  }

  // Contribution legend
  const legendRow = card.createEl("div", { attr: { style: "display: flex; align-items: center; justify-content: flex-end; gap: 4px; padding: 6px 14px; background: var(--background-secondary-alt);" } });
  legendRow.createEl("span", { text: "Less", attr: { style: "font-size: 9px; color: var(--text-faint);" } });
  for (let i = 0; i <= 4; i++) {
    const bg = i === 0 ? "var(--background-modifier-border)" : contribColors[i];
    legendRow.createEl("div", { attr: { style: `width: 10px; height: 10px; border-radius: 2px; background: ${bg};` } });
  }
  legendRow.createEl("span", { text: "More", attr: { style: "font-size: 9px; color: var(--text-faint);" } });

  // ══════════════════════════
  // ── Issue List (선택 날짜) ──
  // ══════════════════════════
  const selTasks = tasksForDate(cs.selDate);
  const openCount = selTasks.filter(t => !t.completed).length;
  const closedCount = selTasks.filter(t => t.completed).length;

  const issueCard = wrapper.createEl("div", { attr: { style: "border: 1px solid var(--background-modifier-border); border-radius: 8px; overflow: hidden; background: var(--background-primary); margin: 8px 16px 30px;" } });

  // Issue header
  const issueHdr = issueCard.createEl("div", { attr: { style: "display: flex; align-items: center; gap: 16px; padding: 8px 14px; background: var(--background-secondary-alt);" } });

  const openBadge = issueHdr.createEl("span", { attr: { style: "display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; font-family: 'SF Mono', ui-monospace, monospace;" } });
  openBadge.createEl("span", { text: "○", attr: { style: "color: #2DA44E;" } });
  openBadge.createEl("span", { text: `${openCount} Open` });

  const closedBadge = issueHdr.createEl("span", { attr: { style: "display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-muted); font-family: 'SF Mono', ui-monospace, monospace;" } });
  closedBadge.createEl("span", { text: "✓" });
  closedBadge.createEl("span", { text: `${closedCount} Closed` });

  issueHdr.createEl("span", { attr: { style: "flex: 1;" } });

  // 선택 날짜 라벨
  const sd = new Date(cs.selDate + "T00:00:00");
  const dayNames = ["일","월","화","수","목","금","토"];
  issueHdr.createEl("span", {
    text: `${sd.getMonth()+1}월 ${sd.getDate()}일 (${dayNames[sd.getDay()]})`,
    attr: { style: "font-size: 11px; color: var(--text-muted); font-family: 'SF Mono', ui-monospace, monospace;" }
  });

  // +New button → 인라인 폼 토글
  const newBtn = issueHdr.createEl("button", { attr: {
    style: "display: flex; align-items: center; gap: 3px; padding: 4px 8px; border-radius: 6px; border: none; background: #2DA44E; color: white; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'SF Mono', ui-monospace, monospace;"
  }});
  newBtn.createEl("span", { text: "+" });
  newBtn.createEl("span", { text: "New" });

  let formVisible = false;
  let formEl = null;

  // ── 과목 목록 (폴더명) ──
  const folders = Object.keys(tagColors);

  // +New 클릭 → 인라인 추가 폼
  newBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (formVisible && formEl) {
      formEl.remove();
      formEl = null;
      formVisible = false;
      return;
    }
    formVisible = true;

    formEl = issueCard.createEl("div", { attr: {
      style: "border-top: 1px solid var(--background-modifier-border); padding: 10px 14px; background: var(--background-primary);"
    }});
    formEl.addEventListener("mousedown", ev => ev.stopPropagation());
    formEl.addEventListener("click", ev => ev.stopPropagation());

    // 제목 입력
    const titleRow = formEl.createEl("div", { attr: { style: "display: flex; align-items: center; gap: 8px; margin-bottom: 8px;" } });
    titleRow.createEl("span", { text: "○", attr: { style: "font-size: 14px; color: #2DA44E;" } });
    const titleInput = titleRow.createEl("input", { attr: {
      type: "text",
      placeholder: "할 일 입력...",
      style: "flex: 1; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary); color: var(--text-normal); font-size: 13px; outline: none;"
    }});
    setTimeout(() => titleInput.focus(), 50);

    // 과목 선택 (수평 스크롤)
    const tagRow = formEl.createEl("div", { attr: { style: "display: flex; gap: 4px; margin-bottom: 10px; overflow-x: auto; padding-bottom: 2px;" } });

    let selectedFolder = "";

    // "없음" 버튼
    const noneBtn = tagRow.createEl("span", { text: "—", attr: {
      style: "font-size: 11px; font-weight: 600; color: white; background: #2DA44E; padding: 3px 10px; border-radius: 6px; cursor: pointer; white-space: nowrap;"
    }});
    noneBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      selectedFolder = "";
      updateTagSelection();
    });

    const tagBtns = [];
    for (const fname of folders) {
      const c = getTagColor(fname);
      const btn = tagRow.createEl("span", { attr: {
        style: `font-size: 11px; padding: 3px 10px; border-radius: 6px; cursor: pointer; white-space: nowrap; color: var(--text-normal); background: ${c}18;`
      }});
      btn.createEl("span", { text: "● ", attr: { style: `color: ${c};` } });
      btn.createEl("span", { text: fname });
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        selectedFolder = fname;
        updateTagSelection();
      });
      tagBtns.push({ el: btn, name: fname });
    }

    function updateTagSelection() {
      noneBtn.style.background = selectedFolder === "" ? "#2DA44E" : "var(--background-modifier-border)";
      noneBtn.style.color = selectedFolder === "" ? "white" : "var(--text-muted)";
      for (const b of tagBtns) {
        const c = getTagColor(b.name);
        if (b.name === selectedFolder) {
          b.el.style.background = c;
          b.el.style.color = "white";
          b.el.querySelector("span").style.color = "white";
        } else {
          b.el.style.background = c + "18";
          b.el.style.color = "var(--text-normal)";
          b.el.querySelector("span").style.color = c;
        }
      }
    }

    // 하단: 날짜 라벨 + Cancel + Submit
    const bottomRow = formEl.createEl("div", { attr: { style: "display: flex; align-items: center; gap: 6px;" } });

    const dateBadge = bottomRow.createEl("span", { attr: {
      style: "display: flex; align-items: center; gap: 3px; font-size: 10px; color: #2DA44E; background: rgba(45,164,78,0.08); padding: 3px 8px; border-radius: 6px;"
    }});
    dateBadge.createEl("span", { text: "📅" });
    dateBadge.createEl("span", { text: `${sd.getMonth()+1}/${sd.getDate()} (${dayNames[sd.getDay()]})` });

    bottomRow.createEl("span", { attr: { style: "flex: 1;" } });

    const cancelBtn = bottomRow.createEl("button", { text: "Cancel", attr: {
      style: "padding: 4px 10px; border: none; background: none; color: var(--text-muted); font-size: 11px; cursor: pointer;"
    }});
    cancelBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      formEl.remove(); formEl = null; formVisible = false;
    });

    const submitBtn = bottomRow.createEl("button", { text: "Submit", attr: {
      style: "padding: 4px 12px; border: none; border-radius: 6px; background: #2DA44E; color: white; font-size: 11px; font-weight: 600; cursor: pointer;"
    }});

    async function submitTask() {
      const title = titleInput.value.trim();
      if (!title) return;

      const dateStr = cs.selDate;
      const dailyPath = `Daily/${dateStr}.md`;
      let file = app.vault.getAbstractFileByPath(dailyPath);

      const tagMeta = selectedFolder ? ` %%tag:${selectedFolder}%%` : "";
      const taskLine = `- [ ] ${title}${tagMeta}`;

      if (file) {
        const content = await app.vault.read(file);
        // "## 오늘 할 일" 섹션 아래에 추가
        const marker = "## 오늘 할 일";
        const idx = content.indexOf(marker);
        if (idx >= 0) {
          const afterMarker = idx + marker.length;
          const newContent = content.slice(0, afterMarker) + "\n" + taskLine + content.slice(afterMarker);
          await app.vault.modify(file, newContent);
        } else {
          await app.vault.modify(file, content.trimEnd() + "\n" + taskLine + "\n");
        }
      } else {
        const tmplFile = app.vault.getAbstractFileByPath("Templates/Daily Note.md");
        let tmpl = "## 오늘 할 일\n\n---\n\n## 공부 기록\n\n| 과목 | 시작 | 종료 | 시간 |\n| --- | --- | --- | --- |\n|  |  |  |  |\n\n---\n\n## 메모\n\n";
        if (tmplFile) tmpl = await app.vault.read(tmplFile);
        const marker = "## 오늘 할 일";
        const idx = tmpl.indexOf(marker);
        if (idx >= 0) {
          const afterMarker = idx + marker.length;
          tmpl = tmpl.slice(0, afterMarker) + "\n" + taskLine + tmpl.slice(afterMarker);
        } else {
          tmpl = tmpl.trimEnd() + "\n" + taskLine + "\n";
        }
        await app.vault.create(dailyPath, tmpl);
      }

      formEl.remove(); formEl = null; formVisible = false;
      // 약간의 딜레이 후 리렌더 (dataview 캐시 갱신)
      setTimeout(() => render(), 300);
    }

    submitBtn.addEventListener("click", (ev) => { ev.stopPropagation(); submitTask(); });
    titleInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.stopPropagation(); submitTask(); }
      if (ev.key === "Escape") { ev.stopPropagation(); formEl.remove(); formEl = null; formVisible = false; }
    });
  });

  // Tag filter (사용된 태그)
  const usedTags = [...new Set(selTasks.map(t => t.tag).filter(Boolean))];
  if (usedTags.length > 0) {
    const tagBar = issueCard.createEl("div", { attr: { style: "display: flex; gap: 5px; padding: 6px 14px; border-bottom: 1px solid var(--background-modifier-border); overflow-x: auto;" } });
    const allTag = tagBar.createEl("span", { text: "All", attr: { style: "font-size: 11px; font-weight: 600; color: white; background: #2DA44E; padding: 2px 8px; border-radius: 10px; cursor: pointer; font-family: 'SF Mono', ui-monospace, monospace;" } });
    for (const tag of usedTags) {
      const c = getTagColor(tag);
      tagBar.createEl("span", {
        text: `● ${tag}`,
        attr: { style: `font-size: 11px; color: ${c}; background: ${c}15; padding: 2px 8px; border-radius: 10px; white-space: nowrap; font-family: 'SF Mono', ui-monospace, monospace;` }
      });
    }
  }

  // ── 태스크 삭제 함수 ──
  async function deleteTask(task) {
    const file = app.vault.getAbstractFileByPath(task.path);
    if (!file) return;
    const content = await app.vault.read(file);
    const lines = content.split("\n");
    if (task.line != null && lines[task.line] != null) {
      lines.splice(task.line, 1);
      await app.vault.modify(file, lines.join("\n"));
    }
    setTimeout(() => render(), 300);
  }

  // ── 태스크 수정 함수 (날짜 변경 = 파일 이동) ──
  async function editTask(task, newText, newTag, newDate) {
    const file = app.vault.getAbstractFileByPath(task.path);
    if (!file) return;
    const content = await app.vault.read(file);
    const lines = content.split("\n");
    const check = task.completed ? "[x]" : "[ ]";
    const tagMeta = newTag ? ` %%tag:${newTag}%%` : "";
    const newLine = `- ${check} ${newText}${tagMeta}`;

    // 날짜가 변경되었으면 → 기존 파일에서 삭제 후 새 파일에 추가
    if (newDate && newDate !== task.due) {
      // 기존 파일에서 제거
      if (task.line != null && lines[task.line] != null) {
        lines.splice(task.line, 1);
        await app.vault.modify(file, lines.join("\n"));
      }
      // 새 날짜 파일에 추가
      const newPath = `Daily/${newDate}.md`;
      let newFile = app.vault.getAbstractFileByPath(newPath);
      if (newFile) {
        const nc = await app.vault.read(newFile);
        const marker = "## 오늘 할 일";
        const idx = nc.indexOf(marker);
        if (idx >= 0) {
          const after = idx + marker.length;
          await app.vault.modify(newFile, nc.slice(0, after) + "\n" + newLine + nc.slice(after));
        } else {
          await app.vault.modify(newFile, nc.trimEnd() + "\n" + newLine + "\n");
        }
      } else {
        const tmpl = "## 오늘 할 일\n" + newLine + "\n\n---\n\n## 공부 기록\n\n| 과목 | 시작 | 종료 | 시간 |\n| --- | --- | --- | --- |\n|  |  |  |  |\n\n---\n\n## 메모\n\n";
        await app.vault.create(newPath, tmpl);
      }
    } else {
      // 같은 파일에서 수정
      if (task.line != null && lines[task.line] != null) {
        lines[task.line] = newLine;
        await app.vault.modify(file, lines.join("\n"));
      }
    }
    setTimeout(() => render(), 300);
  }

  // Issue list
  if (selTasks.length === 0) {
    const emptyRow = issueCard.createEl("div", { attr: { style: "display: flex; align-items: center; justify-content: center; gap: 8px; padding: 24px; color: var(--text-faint);" } });
    emptyRow.createEl("span", { text: "📭" });
    emptyRow.createEl("span", { text: "No issues for this date", attr: { style: "font-size: 13px; font-family: 'SF Mono', ui-monospace, monospace;" } });
  } else {
    for (const t of selTasks) {
      const rowWrap = issueCard.createEl("div", { attr: { style: "border-top: 1px solid var(--background-modifier-border-hover);" } });
      rowWrap.addEventListener("mousedown", ev => ev.stopPropagation());
      rowWrap.addEventListener("click", ev => ev.stopPropagation());

      const row = rowWrap.createEl("div", { attr: {
        style: "display: flex; align-items: center; gap: 8px; padding: 6px 14px;"
      }});

      // Check icon (토글)
      const checkColor = t.completed ? "var(--text-muted)" : "#2DA44E";
      const checkEl = row.createEl("span", {
        text: t.completed ? "✓" : "○",
        attr: { style: `font-size: 14px; color: ${checkColor}; width: 20px; text-align: center; cursor: pointer;` }
      });
      checkEl.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const file = app.vault.getAbstractFileByPath(t.path);
        if (!file) return;
        const content = await app.vault.read(file);
        const lines = content.split("\n");
        if (t.line != null && lines[t.line] != null) {
          if (t.completed) {
            lines[t.line] = lines[t.line].replace("- [x]", "- [ ]");
          } else {
            lines[t.line] = lines[t.line].replace("- [ ]", "- [x]");
          }
          await app.vault.modify(file, lines.join("\n"));
        }
        setTimeout(() => render(), 300);
      });

      // Tag color dot
      if (t.tag) {
        const c = getTagColor(t.tag);
        row.createEl("span", { text: "●", attr: { style: `font-size: 10px; color: ${c}; flex-shrink: 0;` } });
      }

      // Title
      row.createEl("span", {
        text: t.text,
        attr: { style: `font-size: 13px; flex: 1; ${t.completed ? "color: var(--text-muted); text-decoration: line-through;" : "font-weight: 500;"} font-family: 'SF Mono', ui-monospace, monospace;` }
      });

      // Tag color chip
      if (t.tag) {
        const c = getTagColor(t.tag);
        const tagChip = row.createEl("span", { attr: { style: `display: flex; align-items: center; gap: 3px; font-size: 11px; color: ${c}; background: ${c}15; padding: 2px 8px; border-radius: 10px; white-space: nowrap; flex-shrink: 0; font-family: 'SF Mono', ui-monospace, monospace;` } });
        tagChip.createEl("span", { text: "●", attr: { style: `font-size: 8px;` } });
        tagChip.createEl("span", { text: t.tag });
      }

      // 우클릭 → 컨텍스트 메뉴
      row.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        // 기존 메뉴 제거
        document.querySelectorAll(".cal-ctx-menu").forEach(e => e.remove());

        const menu = document.body.createEl("div", { cls: "cal-ctx-menu", attr: {
          style: `position: fixed; top: ${ev.clientY}px; left: ${ev.clientX}px; z-index: 9999; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 4px; min-width: 120px;`
        }});

        const menuItemStyle = "display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; font-family: 'SF Mono', ui-monospace, monospace;";

        // 수정 메뉴
        const editItem = menu.createEl("div", { attr: { style: menuItemStyle } });
        editItem.createEl("span", { text: "✏️", attr: { style: "font-size: 12px;" } });
        editItem.createEl("span", { text: "수정" });
        editItem.addEventListener("mouseenter", () => editItem.style.background = "var(--background-modifier-hover)");
        editItem.addEventListener("mouseleave", () => editItem.style.background = "none");
        editItem.addEventListener("click", (ev2) => {
          ev2.stopPropagation();
          menu.remove();
          // 인라인 편집 폼
          const existing = rowWrap.querySelector(".edit-form");
          if (existing) { existing.remove(); return; }

          const form = rowWrap.createEl("div", { cls: "edit-form", attr: { style: "display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 14px 10px; background: var(--background-secondary);" } });
          form.addEventListener("mousedown", ev3 => ev3.stopPropagation());
          form.addEventListener("click", ev3 => ev3.stopPropagation());

          const input = form.createEl("input", { attr: {
            type: "text", value: t.text,
            style: "flex: 1; min-width: 150px; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); color: var(--text-normal); font-size: 12px; outline: none;"
          }});
          setTimeout(() => input.focus(), 50);

          // 날짜 선택
          const dateInput = form.createEl("input", { attr: {
            type: "date", value: t.due || cs.selDate,
            style: "padding: 4px 8px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); color: var(--text-normal); font-size: 12px;"
          }});

          // 태그 선택
          const tagSelect = form.createEl("select", { attr: {
            style: "padding: 4px 8px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); color: var(--text-normal); font-size: 12px;"
          }});
          tagSelect.createEl("option", { text: "— 태그 없음", value: "" });
          for (const fname of folders) {
            const opt = tagSelect.createEl("option", { text: fname, value: fname });
            if (t.tag === fname) opt.selected = true;
          }

          const saveBtn = form.createEl("button", { text: "저장", attr: {
            style: "padding: 4px 12px; border: none; border-radius: 6px; background: #2DA44E; color: white; font-size: 11px; font-weight: 600; cursor: pointer;"
          }});
          saveBtn.addEventListener("click", async (ev3) => {
            ev3.stopPropagation();
            await editTask(t, input.value.trim(), tagSelect.value, dateInput.value);
          });

          const cancelBtn = form.createEl("button", { text: "취소", attr: {
            style: "padding: 4px 10px; border: none; background: none; color: var(--text-muted); font-size: 11px; cursor: pointer;"
          }});
          cancelBtn.addEventListener("click", (ev3) => { ev3.stopPropagation(); form.remove(); });

          input.addEventListener("keydown", async (ev3) => {
            if (ev3.key === "Enter") { ev3.stopPropagation(); await editTask(t, input.value.trim(), tagSelect.value, dateInput.value); }
            if (ev3.key === "Escape") { ev3.stopPropagation(); form.remove(); }
          });
        });

        // 삭제 메뉴
        const delItem = menu.createEl("div", { attr: { style: menuItemStyle + " color: #D73A4A;" } });
        delItem.createEl("span", { text: "🗑", attr: { style: "font-size: 12px;" } });
        delItem.createEl("span", { text: "삭제" });
        delItem.addEventListener("mouseenter", () => delItem.style.background = "var(--background-modifier-hover)");
        delItem.addEventListener("mouseleave", () => delItem.style.background = "none");
        delItem.addEventListener("click", async (ev2) => {
          ev2.stopPropagation();
          menu.remove();
          await deleteTask(t);
        });

        // 바깥 클릭 시 메뉴 닫기
        setTimeout(() => {
          const closeMenu = (ev2) => { menu.remove(); document.removeEventListener("click", closeMenu); };
          document.addEventListener("click", closeMenu);
        }, 10);
      });
    }
  }

  // ══════════════════════════
  // ── 반복 이벤트 관리 ──
  // ══════════════════════════
  const recurCard = wrapper.createEl("div", { attr: { style: "border: 1px solid var(--background-modifier-border); border-radius: 8px; overflow: hidden; background: var(--background-primary); margin: 8px 16px 30px;" } });

  const recurHdr = recurCard.createEl("div", { attr: { style: "display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: var(--background-secondary-alt);" } });
  recurHdr.createEl("span", { text: "🔁", attr: { style: "font-size: 14px;" } });
  recurHdr.createEl("span", { text: "반복 이벤트", attr: { style: "font-size: 13px; font-weight: 700;" } });
  recurHdr.createEl("span", { attr: { style: "flex: 1;" } });

  // +Add 버튼
  const addRecurBtn = recurHdr.createEl("button", { attr: {
    style: "display: flex; align-items: center; gap: 3px; padding: 4px 8px; border-radius: 6px; border: none; background: #2DA44E; color: white; font-size: 11px; font-weight: 600; cursor: pointer;"
  }});
  addRecurBtn.createEl("span", { text: "+" });
  addRecurBtn.createEl("span", { text: "Add" });

  // 반복 패턴 옵션
  const recurPatterns = [
    { label: "매일", value: "every day" },
    { label: "평일만", value: "every weekday" },
    { label: "월요일", value: "every monday" },
    { label: "화요일", value: "every tuesday" },
    { label: "수요일", value: "every wednesday" },
    { label: "목요일", value: "every thursday" },
    { label: "금요일", value: "every friday" },
    { label: "토요일", value: "every saturday" },
    { label: "일요일", value: "every sunday" },
  ];

  // Recurring Tasks.md 읽기 & 파싱
  const RECUR_PATH = "Recurring Tasks.md";
  async function readRecurTasks() {
    const file = app.vault.getAbstractFileByPath(RECUR_PATH);
    if (!file) return [];
    const content = await app.vault.read(file);
    const lines = content.split("\n");
    const tasks = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^- \[( |x)\] (.+?)\s+(🔁\s*.+)$/);
      if (m) {
        tasks.push({
          line: i,
          completed: m[1] === "x",
          text: m[2].trim(),
          recur: m[3].trim(),
          raw: lines[i]
        });
      }
    }
    return tasks;
  }

  async function addRecurTask(text, pattern) {
    const file = app.vault.getAbstractFileByPath(RECUR_PATH);
    const newLine = `- [ ] ${text} 🔁 ${pattern}`;
    if (file) {
      const content = await app.vault.read(file);
      // "### 매일" 또는 "### 매주 특정 요일" 섹션 뒤에 추가
      const section = pattern === "every day" ? "### 매일" : "### 매주 특정 요일";
      const idx = content.indexOf(section);
      if (idx >= 0) {
        const afterSection = content.indexOf("\n", idx) + 1;
        const newContent = content.slice(0, afterSection) + newLine + "\n" + content.slice(afterSection);
        await app.vault.modify(file, newContent);
      } else {
        await app.vault.modify(file, content.trimEnd() + "\n" + newLine + "\n");
      }
    } else {
      await app.vault.create(RECUR_PATH, `---\nsticker: lucide//repeat\ncolor: var(--mk-color-green)\n---\n\n## 반복 태스크\n\n### 매일\n${pattern === "every day" ? newLine + "\n" : ""}\n### 매주 특정 요일\n${pattern !== "every day" ? newLine + "\n" : ""}`);
    }
  }

  async function deleteRecurTask(lineNum) {
    const file = app.vault.getAbstractFileByPath(RECUR_PATH);
    if (!file) return;
    const content = await app.vault.read(file);
    const lines = content.split("\n");
    if (lines[lineNum] != null) {
      lines.splice(lineNum, 1);
      await app.vault.modify(file, lines.join("\n"));
    }
  }

  // 기존 반복 태스크 표시
  const recurTasks = await readRecurTasks();

  if (recurTasks.length === 0) {
    const emptyRow = recurCard.createEl("div", { attr: { style: "display: flex; align-items: center; justify-content: center; gap: 8px; padding: 20px; color: var(--text-faint);" } });
    emptyRow.createEl("span", { text: "🔁" });
    emptyRow.createEl("span", { text: "반복 이벤트가 없습니다", attr: { style: "font-size: 13px;" } });
  } else {
    for (const rt of recurTasks) {
      const rtRow = recurCard.createEl("div", { attr: {
        style: "display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-top: 1px solid var(--background-modifier-border-hover);"
      }});
      rtRow.addEventListener("mousedown", ev => ev.stopPropagation());
      rtRow.addEventListener("click", ev => ev.stopPropagation());

      // 반복 아이콘
      rtRow.createEl("span", { text: "🔁", attr: { style: "font-size: 12px; flex-shrink: 0;" } });

      // 태스크 텍스트
      rtRow.createEl("span", { text: rt.text, attr: { style: "font-size: 13px; font-weight: 500; flex: 1;" } });

      // 반복 패턴 배지
      const patternText = rt.recur.replace("🔁", "").trim();
      const patternLabel = recurPatterns.find(p => p.value === patternText);
      rtRow.createEl("span", {
        text: patternLabel ? patternLabel.label : patternText,
        attr: { style: "font-size: 11px; color: #2DA44E; background: rgba(45,164,78,0.1); padding: 2px 8px; border-radius: 10px; white-space: nowrap;" }
      });

      // 삭제 버튼
      const delBtn = rtRow.createEl("span", { text: "✕", attr: {
        style: "font-size: 11px; color: var(--text-faint); cursor: pointer; padding: 2px 4px; border-radius: 4px; flex-shrink: 0;"
      }});
      delBtn.addEventListener("mouseenter", () => { delBtn.style.color = "#D73A4A"; delBtn.style.background = "rgba(215,58,74,0.1)"; });
      delBtn.addEventListener("mouseleave", () => { delBtn.style.color = "var(--text-faint)"; delBtn.style.background = "none"; });
      delBtn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        await deleteRecurTask(rt.line);
        setTimeout(() => render(), 300);
      });
    }
  }

  // +Add 폼
  let recurFormVisible = false;
  let recurFormEl = null;

  addRecurBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (recurFormVisible && recurFormEl) {
      recurFormEl.remove(); recurFormEl = null; recurFormVisible = false;
      return;
    }
    recurFormVisible = true;

    recurFormEl = recurCard.createEl("div", { attr: {
      style: "border-top: 1px solid var(--background-modifier-border); padding: 10px 14px; background: var(--background-primary);"
    }});
    recurFormEl.addEventListener("mousedown", ev => ev.stopPropagation());
    recurFormEl.addEventListener("click", ev => ev.stopPropagation());

    // 입력 행
    const inputRow = recurFormEl.createEl("div", { attr: { style: "display: flex; align-items: center; gap: 8px; margin-bottom: 8px;" } });
    inputRow.createEl("span", { text: "🔁", attr: { style: "font-size: 14px;" } });
    const recurInput = inputRow.createEl("input", { attr: {
      type: "text", placeholder: "반복할 일 입력...",
      style: "flex: 1; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary); color: var(--text-normal); font-size: 13px; outline: none;"
    }});
    setTimeout(() => recurInput.focus(), 50);

    // 패턴 선택 (가로 스크롤 칩)
    const patternRow = recurFormEl.createEl("div", { attr: { style: "display: flex; gap: 4px; margin-bottom: 10px; overflow-x: auto; padding-bottom: 2px;" } });

    let selectedPattern = "every day";
    const patternBtns = [];

    for (const p of recurPatterns) {
      const isSelected = p.value === selectedPattern;
      const btn = patternRow.createEl("span", { text: p.label, attr: {
        style: `font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px; cursor: pointer; white-space: nowrap; ${isSelected ? "color: white; background: #2DA44E;" : "color: var(--text-muted); background: var(--background-modifier-border);"}`
      }});
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        selectedPattern = p.value;
        updatePatternSelection();
      });
      patternBtns.push({ el: btn, value: p.value });
    }

    function updatePatternSelection() {
      for (const b of patternBtns) {
        if (b.value === selectedPattern) {
          b.el.style.background = "#2DA44E";
          b.el.style.color = "white";
        } else {
          b.el.style.background = "var(--background-modifier-border)";
          b.el.style.color = "var(--text-muted)";
        }
      }
    }

    // 하단 버튼
    const bottomRow = recurFormEl.createEl("div", { attr: { style: "display: flex; align-items: center; gap: 6px; justify-content: flex-end;" } });

    const cancelBtn = bottomRow.createEl("button", { text: "Cancel", attr: {
      style: "padding: 4px 10px; border: none; background: none; color: var(--text-muted); font-size: 11px; cursor: pointer;"
    }});
    cancelBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      recurFormEl.remove(); recurFormEl = null; recurFormVisible = false;
    });

    const submitBtn = bottomRow.createEl("button", { text: "Add", attr: {
      style: "padding: 4px 12px; border: none; border-radius: 6px; background: #2DA44E; color: white; font-size: 11px; font-weight: 600; cursor: pointer;"
    }});

    async function submitRecur() {
      const title = recurInput.value.trim();
      if (!title) return;
      await addRecurTask(title, selectedPattern);
      recurFormEl.remove(); recurFormEl = null; recurFormVisible = false;
      setTimeout(() => render(), 300);
    }

    submitBtn.addEventListener("click", (ev) => { ev.stopPropagation(); submitRecur(); });
    recurInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.stopPropagation(); submitRecur(); }
      if (ev.key === "Escape") { ev.stopPropagation(); recurFormEl.remove(); recurFormEl = null; recurFormVisible = false; }
    });
  });
}

render();
```
