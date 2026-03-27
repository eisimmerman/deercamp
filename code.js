document.addEventListener("DOMContentLoaded", () => {
  const calendarGrid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("calendarMonthLabel");
  const eventList = document.getElementById("calendarEventList");
  const prevBtn = document.getElementById("calendarPrev");
  const nextBtn = document.getElementById("calendarNext");

  if (!calendarGrid || !monthLabel || !eventList || !prevBtn || !nextBtn) {
    return;
  }

  let events = [];
  let currentDate = new Date();
  let calendarYear = currentDate.getFullYear();

  function getCampData() {
    try {
      return JSON.parse(localStorage.getItem("campData")) || {};
    } catch (error) {
      return {};
    }
  }

  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function humanDate(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getEventsForDate(dateKey) {
    return events
      .filter((event) => event.date === dateKey)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function renderWeekdays() {
    const existing = document.querySelector(".calendar-weekdays");
    if (existing) existing.remove();

    const weekdays = document.createElement("div");
    weekdays.className = "calendar-weekdays";

    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((label) => {
      const day = document.createElement("div");
      day.className = "calendar-weekday";
      day.textContent = label;
      weekdays.appendChild(day);
    });

    calendarGrid.parentNode.insertBefore(weekdays, calendarGrid);
  }

  function renderMonthEvents() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthEvents = events
      .filter((event) => {
        const eventDate = new Date(`${event.date}T00:00:00`);
        return eventDate.getFullYear() === year && eventDate.getMonth() === month;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    if (monthEvents.length === 0) {
      eventList.innerHTML = `<p>No official season opener dates this month.</p>`;
      return;
    }

    eventList.innerHTML = monthEvents.map((event) => {
      const sourceLine = event.source ? `<span>${escapeHtml(event.source)}</span>` : "";
      const descriptionLine = event.description ? `<span>${escapeHtml(event.description)}</span>` : "";

      return `
        <div class="calendar-event">
          <strong>${escapeHtml(event.name)}</strong>
          <span>${escapeHtml(humanDate(event.date))}</span>
          ${descriptionLine}
          ${sourceLine}
        </div>
      `;
    }).join("");
  }

  function renderEventList(dateKey) {
    const dayEvents = getEventsForDate(dateKey);

    if (dayEvents.length === 0) {
      eventList.innerHTML = `<p>No official season opener dates for this day.</p>`;
      return;
    }

    eventList.innerHTML = dayEvents.map((event) => {
      const sourceLine = event.source ? `<span>${escapeHtml(event.source)}</span>` : "";
      const descriptionLine = event.description ? `<span>${escapeHtml(event.description)}</span>` : "";

      return `
        <div class="calendar-event">
          <strong>${escapeHtml(event.name)}</strong>
          <span>${escapeHtml(humanDate(event.date))}</span>
          ${descriptionLine}
          ${sourceLine}
        </div>
      `;
    }).join("");
  }

  function buildEventDot() {
    const dot = document.createElement("div");
    dot.setAttribute(
      "style",
      [
        "width:8px",
        "height:8px",
        "border-radius:999px",
        "margin:6px auto 0",
        "background:#7a2f1c",
        "box-shadow:0 0 0 2px rgba(122,47,28,0.12)"
      ].join(";")
    );
    return dot;
  }

  function renderCalendar() {
    calendarGrid.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    monthLabel.textContent = firstDay.toLocaleString("default", {
      month: "long",
      year: "numeric"
    });

    renderWeekdays();

    for (let i = 0; i < startDay; i += 1) {
      const empty = document.createElement("button");
      empty.type = "button";
      empty.className = "calendar-day empty";
      empty.disabled = true;
      calendarGrid.appendChild(empty);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const dateObj = new Date(year, month, day);
      const dateKey = formatDateKey(dateObj);
      const dayEvents = getEventsForDate(dateKey);

      const dayEl = document.createElement("button");
      dayEl.type = "button";
      dayEl.className = "calendar-day";
      dayEl.innerHTML = `<div class="calendar-day-number">${day}</div>`;

      if (dayEvents.length) {
        dayEl.dataset.hasEvent = "true";
        dayEl.appendChild(buildEventDot());
      }

      dayEl.addEventListener("click", () => renderEventList(dateKey));
      calendarGrid.appendChild(dayEl);
    }

    renderMonthEvents();
  }

  prevBtn.addEventListener("click", () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    renderCalendar();
  });

  nextBtn.addEventListener("click", () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    renderCalendar();
  });

  function loadEvents() {
    const campData = getCampData();
    const storedEvents = Array.isArray(campData.calendarEvents) ? campData.calendarEvents : [];
    events = storedEvents
      .filter((event) => event && event.date && (event.name || event.title))
      .map((event) => ({
        ...event,
        name: event.name || event.title
      }));

    const establishedYear = Number.parseInt(campData.established, 10);
    const firstEventDate = events.length ? new Date(`${events[0].date}T00:00:00`) : null;

    if (firstEventDate && !Number.isNaN(firstEventDate.getTime())) {
      currentDate = new Date(firstEventDate.getFullYear(), firstEventDate.getMonth(), 1);
      calendarYear = firstEventDate.getFullYear();
    } else if (!Number.isNaN(establishedYear) && establishedYear > 1900) {
      currentDate = new Date(establishedYear, 0, 1);
      calendarYear = establishedYear;
    } else {
      currentDate = new Date(new Date().getFullYear(), 0, 1);
      calendarYear = currentDate.getFullYear();
    }

    if (!events.length) {
      eventList.innerHTML = `<p>No official season opener dates are loaded for this camp yet.</p>`;
    }

    renderCalendar();
  }

  loadEvents();
});