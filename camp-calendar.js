document.addEventListener("DOMContentLoaded", async () => {
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

  function buildDefaultEvents() {
    const year = new Date().getFullYear();
    return [
      { name: "Spring Scouting", date: `${year}-04-15`, type: "prep" },
      { name: "Food Plot Prep", date: `${year}-05-20`, type: "prep" },
      { name: "Stand Preparation", date: `${year}-09-10`, type: "prep" },
      { name: "Bow Season Opener", date: `${year}-09-15`, type: "season" },
      { name: "Gun Season Opener", date: `${year}-11-09`, type: "season" },
      { name: "Opening Night Chili", date: `${year}-11-08`, type: "camp" }
    ];
  }

  function renderWeekdays() {
    const existing = document.querySelector(".calendar-weekdays");
    if (existing) existing.remove();

    const weekdays = document.createElement("div");
    weekdays.className = "calendar-weekdays";

    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    labels.forEach(label => {
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
      .filter(event => {
        const eventDate = new Date(event.date + "T00:00:00");
        return eventDate.getFullYear() === year && eventDate.getMonth() === month;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    if (monthEvents.length === 0) {
      eventList.innerHTML = `<p>No events this month.</p>`;
      return;
    }

    eventList.innerHTML = monthEvents.map(event => `
      <div class="calendar-event">
        <strong>${event.name}</strong>
        <span>${event.date} · ${event.type}</span>
      </div>
    `).join("");
  }

  function renderEventList(dateKey) {
    const dayEvents = events.filter(event => event.date === dateKey);

    if (dayEvents.length === 0) {
      eventList.innerHTML = `<p>No events for this day.</p>`;
      return;
    }

    eventList.innerHTML = dayEvents.map(event => `
      <div class="calendar-event">
        <strong>${event.name}</strong>
        <span>${event.date} · ${event.type}</span>
      </div>
    `).join("");
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

    for (let i = 0; i < startDay; i++) {
      const empty = document.createElement("button");
      empty.type = "button";
      empty.className = "calendar-day empty";
      empty.disabled = true;
      calendarGrid.appendChild(empty);
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(year, month, day);
      const dateKey = formatDateKey(dateObj);

      const dayEl = document.createElement("button");
      dayEl.type = "button";
      dayEl.className = "calendar-day";
      dayEl.innerHTML = `<div class="calendar-day-number">${day}</div>`;
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

  async function loadEvents() {
    const campData = getCampData();

    try {
      const response = await fetch("data/calendar.json", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        const fetchedEvents = Array.isArray(data.events) ? data.events : [];
        events = fetchedEvents.length
          ? fetchedEvents
          : (Array.isArray(campData.calendarEvents) && campData.calendarEvents.length ? campData.calendarEvents : buildDefaultEvents());
      } else {
        throw new Error("calendar json missing");
      }
    } catch (error) {
      events = Array.isArray(campData.calendarEvents) && campData.calendarEvents.length
        ? campData.calendarEvents
        : buildDefaultEvents();
    }

    renderCalendar();
  }

  loadEvents();
});