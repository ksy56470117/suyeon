---
color: var(--mk-color-blue)
cssclass: taskflow-card
---

```dataviewjs
const container = this.container;
container.empty();
container.addEventListener("mousedown", e => e.stopPropagation());
container.addEventListener("click", e => e.stopPropagation());

// ── 설정 ──
const HOUR_START = 6;
const HOUR_END = 24;
const HOUR_HEIGHT = 50;
const HEADER_HEIGHT = 48;

const subjectColors = {
  "26-1":"#2DA44E","4차산업혁명과창의융합SW":"#3B82F6","SW리더십과기업가정신":"#6366F1",
  "국가안보론":"#D73A4A","네트워크보안":"#E36209","북한학":"#0E8A16",
  "신화·상상력·문화":"#A78BFA","한국의문화유산역사여행":"#F59E0B",
  "CPA":"#F97316","01_회계":"#3B82F6","02_세법":"#F59E0B","03_경제학":"#14B8A6",
  "04_경영학":"#E36209","일반경영":"#FB923C","재무관리":"#F472B6",
  "05_기업법":"#6366F1","01_기업법1":"#818CF8","02_기업법2":"#A78BFA"
};
function getColor(name) { return subjectColors[name] || "#8E8E93"; }

// ── 날짜 유틸 ──
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const now = new Date();
const TODAY = localDateStr(now);

// 이번 주 월요일 구하기
const dayOfWeek = now.getDay(); // 0=Sun
const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
const monday = new Date(now);
monday.setDate(now.getDate() + mondayOffset);

const weekDays = [];
const dayNames = ["월", "화", "수", "목", "금", "토", "일"];
for (let i = 0; i < 7; i++) {
  const d = new Date(monday);
  d.setDate(monday.getDate() + i);
  weekDays.push({
    date: d,
    key: localDateStr(d),
    label: dayNames[i],
    dayNum: d.getDate(),
    isToday: localDateStr(d) === TODAY
  });
}

// ── Day Planner 파싱 ──
function dpPath(dateStr) {
  return `Day Planners/Day Planner-${dateStr.replace(/-/g, "")}.md`;
}

function timeToMinutes(t) {
  const p = t.split(":").map(Number);
  return p[0] * 60 + p[1] + (p[2] ? p[2] / 60 : 0);
}

function fmtHM(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

async function readBlocks(dateStr) {
  const file = app.vault.getAbstractFileByPath(dpPath(dateStr));
  if (!file) return [];
  const content = await app.vault.read(file);
  const lines = content.split("\n");
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^- \[.\] (\d{1,2}:\d{2}(?::\d{2})?)\s+(.+?)(?:\s+\(.+?\))?\s*$/);
    if (!m) continue;
    const time = m[1];
    const subject = m[2].trim();
    if (subject === "END" || subject === "BREAK") continue;
    const startMin = timeToMinutes(time);
    // 다음 항목에서 종료시간 찾기
    let endMin = startMin + 30; // 기본 30분
    for (let j = i + 1; j < lines.length; j++) {
      const nm = lines[j].match(/^- \[.\] (\d{1,2}:\d{2}(?::\d{2})?)\s/);
      if (nm) {
        endMin = timeToMinutes(nm[1]);
        break;
      }
    }
    if (endMin > startMin) {
      entries.push({ subject, startMin, endMin, color: getColor(subject) });
    }
  }
  return entries;
}

// ── 주간 블록 데이터 로드 ──
const weekBlocks = {};
for (const day of weekDays) {
  weekBlocks[day.key] = await readBlocks(day.key);
}

// ══════════════════════════
// ── UI 렌더링 ──
// ══════════════════════════
const wrapper = container.createEl("div", { attr: { style: "max-width: 1000px; margin: 0 auto; border: 1px solid var(--background-modifier-border); border-radius: 8px; overflow: hidden; background: var(--background-primary);" } });

// ── 헤더: 주간 네비게이션 ──
const hdr = wrapper.createEl("div", { attr: { style: "display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: var(--background-secondary-alt); border-bottom: 1px solid var(--background-modifier-border);" } });
hdr.createEl("span", { text: "📅", attr: { style: "font-size: 14px;" } });

const monthYear = `${monday.getFullYear()}년 ${monday.getMonth() + 1}월`;
hdr.createEl("span", { text: monthYear, attr: { style: "font-size: 14px; font-weight: 700;" } });
hdr.createEl("span", { attr: { style: "flex: 1;" } });

// ── 요일 헤더 ──
const dayHeader = wrapper.createEl("div", { attr: {
  style: `display: grid; grid-template-columns: 44px repeat(7, 1fr); border-bottom: 1px solid var(--background-modifier-border); background: var(--background-secondary-alt);`
}});
dayHeader.createEl("div"); // 빈 시간 칸

for (const day of weekDays) {
  const cell = dayHeader.createEl("div", { attr: {
    style: `text-align: center; padding: 6px 0; ${day.isToday ? "background: rgba(45,164,78,0.06);" : ""}`
  }});
  cell.createEl("div", { text: day.label, attr: {
    style: `font-size: 11px; font-weight: 600; color: ${day.isToday ? "#2DA44E" : "var(--text-muted)"};`
  }});
  const numStyle = day.isToday
    ? "display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; font-size: 13px; font-weight: 700; color: white; background: #2DA44E; border-radius: 50%;"
    : "font-size: 13px; font-weight: 500; color: var(--text-normal);";
  cell.createEl("div", { text: String(day.dayNum), attr: { style: numStyle } });
}

// ── 타임 그리드 ──
const gridWrap = wrapper.createEl("div", { attr: {
  style: `position: relative; overflow-y: auto; max-height: 600px;`
}});

const grid = gridWrap.createEl("div", { attr: {
  style: `display: grid; grid-template-columns: 44px repeat(7, 1fr); position: relative; height: ${(HOUR_END - HOUR_START) * HOUR_HEIGHT}px;`
}});

// 시간 라벨 컬럼
const timeCol = grid.createEl("div", { attr: {
  style: `position: relative; border-right: 1px solid var(--background-modifier-border);`
}});

for (let h = HOUR_START; h < HOUR_END; h++) {
  const top = (h - HOUR_START) * HOUR_HEIGHT;
  timeCol.createEl("div", { text: `${h}`, attr: {
    style: `position: absolute; top: ${top}px; right: 6px; font-size: 10px; color: var(--text-faint); line-height: 1; transform: translateY(-5px);`
  }});
}

// 각 요일 컬럼
for (let i = 0; i < 7; i++) {
  const day = weekDays[i];
  const col = grid.createEl("div", { attr: {
    style: `position: relative; border-right: ${i < 6 ? "1px solid var(--background-modifier-border-hover)" : "none"}; ${day.isToday ? "background: rgba(45,164,78,0.03);" : ""}`
  }});

  // 시간 가로줄
  for (let h = HOUR_START; h < HOUR_END; h++) {
    const top = (h - HOUR_START) * HOUR_HEIGHT;
    col.createEl("div", { attr: {
      style: `position: absolute; top: ${top}px; left: 0; right: 0; border-top: 1px solid var(--background-modifier-border-hover);`
    }});
    // 30분 점선
    col.createEl("div", { attr: {
      style: `position: absolute; top: ${top + HOUR_HEIGHT / 2}px; left: 0; right: 0; border-top: 1px dashed var(--background-modifier-border-hover); opacity: 0.4;`
    }});
  }

  // 이벤트 블록
  const blocks = weekBlocks[day.key] || [];
  for (const block of blocks) {
    const topPx = ((block.startMin / 60) - HOUR_START) * HOUR_HEIGHT;
    const heightPx = ((block.endMin - block.startMin) / 60) * HOUR_HEIGHT;
    if (topPx < 0 || heightPx <= 0) continue;

    const dur = block.endMin - block.startMin;
    const durLabel = dur >= 60 ? `${Math.floor(dur / 60)}h ${dur % 60}m` : `${dur}m`;

    const ev = col.createEl("div", { attr: {
      style: `position: absolute; top: ${topPx + 1}px; left: 2px; right: 2px; height: ${Math.max(heightPx - 2, 14)}px; background: ${block.color}20; border-left: 3px solid ${block.color}; border-radius: 4px; padding: 2px 4px; overflow: hidden; cursor: default; z-index: 2;`
    }});
    ev.createEl("div", { text: block.subject, attr: {
      style: `font-size: 10px; font-weight: 600; color: ${block.color}; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`
    }});
    if (heightPx > 28) {
      ev.createEl("div", { text: `${fmtHM(block.startMin)}–${fmtHM(block.endMin)}`, attr: {
        style: `font-size: 9px; color: var(--text-muted); line-height: 1.2;`
      }});
    }
  }

  // 현재 시간 빨간 선 (오늘만)
  if (day.isToday) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const nowTop = ((nowMin / 60) - HOUR_START) * HOUR_HEIGHT;
    if (nowTop >= 0 && nowTop <= (HOUR_END - HOUR_START) * HOUR_HEIGHT) {
      const line = col.createEl("div", { attr: {
        style: `position: absolute; top: ${nowTop}px; left: 0; right: 0; height: 2px; background: #D73A4A; z-index: 10;`
      }});
      // 빨간 점
      line.createEl("div", { attr: {
        style: "position: absolute; left: -4px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: #D73A4A;"
      }});
    }
  }
}

// 현재 시간으로 스크롤
const nowMin = now.getHours() * 60 + now.getMinutes();
const scrollTo = Math.max(((nowMin / 60) - HOUR_START) * HOUR_HEIGHT - 150, 0);
gridWrap.scrollTop = scrollTo;
```
