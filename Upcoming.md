---
cssclass: taskflow-card
color: var(--mk-color-yellow)
---

```dataviewjs
const container = this.container;
container.empty();

// 읽기모드 유지
container.addEventListener("mousedown", e => e.stopPropagation());
container.addEventListener("click", e => e.stopPropagation());

const today = new Date();
today.setHours(0,0,0,0);
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function daysBetween(from, to) {
  return Math.round((to - from) / 86400000);
}

function dayLabel(date) {
  const diff = daysBetween(today, date);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  const names = ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"];
  return names[date.getDay()];
}

function monthLabel(date) {
  return `${date.getMonth() + 1}월`;
}

function dDayLabel(date) {
  const diff = daysBetween(today, date);
  if (diff === 0) return null; // 오늘은 날짜 헤더에서 표시
  if (diff === 1) return { text: "내일", color: "#E36209" };
  return { text: `🏁 ${diff}일 후`, color: "var(--text-faint)" };
}

// ── 태스크 수집 ──
const allTasks = dv.pages().file.tasks.where(t => t.text.trim().length > 0);
// due 날짜가 있는 미완료 태스크
const upcoming = [];
const noDate = [];

for (const t of allTasks) {
  if (t.completed) continue;
  // due 날짜 파싱: 📅 YYYY-MM-DD 또는 [due:: YYYY-MM-DD]
  let dueDate = null;
  if (t.due) {
    dueDate = new Date(t.due.toString());
  } else {
    // 파일명에서 날짜 추출 (Daily/YYYY-MM-DD.md)
    const fileMatch = t.path?.match(/(\d{4}-\d{2}-\d{2})/);
    if (fileMatch) dueDate = new Date(fileMatch[1]);
  }

  if (dueDate && !isNaN(dueDate)) {
    dueDate.setHours(0,0,0,0);
    if (dueDate >= today) {
      upcoming.push({ task: t, date: dueDate });
    }
  } else {
    noDate.push(t);
  }
}

// 날짜별 그룹
upcoming.sort((a, b) => a.date - b.date);
const groups = new Map();
for (const item of upcoming) {
  const key = localDateStr(item.date);
  if (!groups.has(key)) groups.set(key, { date: item.date, tasks: [] });
  groups.get(key).tasks.push(item.task);
}

// 날짜 없는 태스크도 "오늘"에 추가
if (noDate.length > 0) {
  const todayKey = localDateStr(today);
  if (!groups.has(todayKey)) groups.set(todayKey, { date: today, tasks: [] });
  for (const t of noDate) groups.get(todayKey).tasks.push(t);
}

// ── 렌더링 ──
const wrapper = container.createEl("div", { attr: { style: "max-width: 800px; margin: 0 auto;" } });

// 헤더
const headerDiv = wrapper.createEl("div", { attr: { style: "display: flex; align-items: center; gap: 8px; padding: 14px 20px 6px;" } });
headerDiv.createEl("span", { text: "⏰", attr: { style: "font-size: 18px;" } });
headerDiv.createEl("span", { text: "Upcoming", attr: { style: "font-size: 20px; font-weight: 700;" } });

if (groups.size === 0) {
  const empty = wrapper.createEl("div", { attr: { style: "text-align: center; padding: 80px 0; color: var(--text-faint);" } });
  empty.createEl("div", { text: "📭", attr: { style: "font-size: 32px; margin-bottom: 8px;" } });
  empty.createEl("div", { text: "예정된 할 일 없음", attr: { style: "font-size: 14px;" } });
} else {
  for (const [key, group] of groups) {
    const date = group.date;
    const diff = daysBetween(today, date);
    const isToday = diff === 0;

    // ── 날짜 헤더 ──
    const dateHeader = wrapper.createEl("div", { attr: {
      style: "display: flex; align-items: baseline; gap: 6px; padding: 14px 20px 4px;"
    }});

    dateHeader.createEl("span", {
      text: String(date.getDate()),
      attr: { style: `font-size: 24px; font-weight: 700; color: ${isToday ? "#2DA44E" : "var(--text-normal)"};` }
    });
    dateHeader.createEl("span", {
      text: dayLabel(date),
      attr: { style: "font-size: 13px; color: var(--text-muted);" }
    });

    const spacer = dateHeader.createEl("span", { attr: { style: "flex: 1;" } });

    if (!isToday && diff > 1) {
      dateHeader.createEl("span", {
        text: monthLabel(date),
        attr: { style: "font-size: 12px; color: var(--text-faint);" }
      });
    }

    // 구분선
    wrapper.createEl("hr", { attr: { style: "margin: 0 20px; border: none; border-top: 1px solid var(--background-modifier-border);" } });

    // ── 태스크 행 ──
    for (const t of group.tasks) {
      const row = wrapper.createEl("div", { attr: {
        style: "display: flex; align-items: center; gap: 8px; padding: 4px 20px; min-height: 32px;"
      }});

      // 체크박스 아이콘
      const checkColor = t.completed ? "var(--text-muted)" : "#2DA44E";
      const checkIcon = t.completed ? "✓" : "○";
      row.createEl("span", {
        text: checkIcon,
        attr: { style: `width: 20px; text-align: center; font-size: 14px; color: ${checkColor};` }
      });

      // 태그 추출
      const tagColors = {
        "26-1":"#2DA44E","4차산업혁명과창의융합SW":"#3B82F6","SW리더십과기업가정신":"#6366F1",
        "국가안보론":"#D73A4A","네트워크보안":"#E36209","북한학":"#0E8A16",
        "신화·상상력·문화":"#A78BFA","한국의문화유산역사여행":"#F59E0B",
        "CPA":"#F97316","01_회계":"#3B82F6","02_세법":"#F59E0B","03_경제학":"#14B8A6",
        "04_경영학":"#E36209","일반경영":"#FB923C","재무관리":"#F472B6",
        "05_기업법":"#6366F1","01_기업법1":"#818CF8","02_기업법2":"#A78BFA"
      };
      let tagName = "";
      // %%tag:...%% 에서 추출
      const metaMatch = t.text.match(/%%tag:(.+?)%%/);
      if (metaMatch) tagName = metaMatch[1];
      // #태그 에서 추출
      if (!tagName) {
        const hashMatch = t.text.match(/#(\S+)/);
        if (hashMatch) tagName = hashMatch[1].replace(/_/g, " ");
      }
      // 폴더에서 추출
      if (!tagName) {
        const folder = t.path?.split("/").slice(0, -1).join("/");
        if (folder && folder !== "Daily" && folder !== "Templates") {
          const parts = folder.split("/");
          tagName = parts[parts.length - 1];
        }
      }

      // 태스크 제목 (태그, 날짜, 메타데이터 제거)
      const cleanText = t.text.replace(/%%tag:.+?%%/g,"").replace(/📅\s*\d{4}-\d{2}-\d{2}/g,"").replace(/[🔁⏫🔼🔽].*$/g,"").replace(/#\S+/g,"").replace(/\d{4}-\d{2}-\d{2}/g,"").trim();
      const titleStyle = t.completed
        ? "font-size: 13px; color: var(--text-muted); text-decoration: line-through;"
        : "font-size: 13px; font-weight: 500;";
      row.createEl("span", { text: cleanText, attr: { style: titleStyle } });

      // 태그 컬러칩
      if (tagName) {
        const tagColor = tagColors[tagName] || "#2DA44E";
        const chip = row.createEl("span", { attr: { style: `display: flex; align-items: center; gap: 3px; font-size: 11px; color: ${tagColor}; background: ${tagColor}15; padding: 1px 8px; border-radius: 10px; white-space: nowrap;` } });
        chip.createEl("span", { text: "●", attr: { style: "font-size: 8px;" } });
        chip.createEl("span", { text: tagName });
      }

      row.createEl("span", { attr: { style: "flex: 1;" } });

      // D-day 라벨
      const dd = dDayLabel(date);
      if (dd) {
        row.createEl("span", {
          text: dd.text,
          attr: { style: `font-size: 11px; color: ${dd.color}; white-space: nowrap;` }
        });
      }
    }
  }
}

// 하단 여백
wrapper.createEl("div", { attr: { style: "height: 40px;" } });
```
