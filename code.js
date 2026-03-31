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
  const DASHBOARD_KEY = "deerCampStewardDashboard";
  const MEMBER_INVITE_KEY = "deerCampMemberInvite";
  let memberEventFeedback = null;
  let calendarYear = currentDate.getFullYear();

  function getCampData() {
    try {
      return JSON.parse(localStorage.getItem("campData")) || {};
    } catch (error) {
      return {};
    }
  }

  function getDashboardData() {
    try {
      return JSON.parse(localStorage.getItem(DASHBOARD_KEY)) || {};
    } catch (error) {
      return {};
    }
  }

  function getMemberInvite() {
    try {
      return JSON.parse(localStorage.getItem(MEMBER_INVITE_KEY)) || {};
    } catch (error) {
      return {};
    }
  }

  function getMemberEventDefaultName() {
    const invite = getMemberInvite();
    if (invite && invite.accepted && invite.name) return String(invite.name).trim();
    const campData = getCampData();
    const profiles = Array.isArray(campData.memberProfiles) ? campData.memberProfiles : [];
    const activeMember = profiles.find((profile) => String(profile?.role || '').trim() === 'Camp Member' && String(profile?.status || 'Active').trim() !== 'Removed');
    return String(activeMember?.name || '').trim();
  }

  function setMemberEventFeedback(message, isWarning = false) {
    if (!memberEventFeedback) return;
    memberEventFeedback.textContent = message;
    memberEventFeedback.dataset.state = isWarning ? 'warning' : 'success';
  }

  function normalizeMemberCalendarEvent(event, fallbackIndex = 0) {
    if (!event || !event.date || !(event.name || event.title)) return null;
    const normalizedName = String(event.name || event.title).trim();
    if (!normalizedName) return null;
    return {
      id: event.id || `calendar-event-${fallbackIndex}`,
      title: event.title || normalizedName,
      name: normalizedName,
      date: String(event.date).trim(),
      type: event.type || 'camp',
      member: String(event.member || '').trim(),
      icon: String(event.icon || '').trim(),
      description: String(event.description || '').trim(),
      source: String(event.source || '').trim(),
      status: String(event.status || 'Active').trim() || 'Active'
    };
  }

  function saveMemberCalendarEvent(payload) {
    const campData = getCampData();
    const dashboard = getDashboardData();
    const nextCampEvents = Array.isArray(campData.calendarEvents) ? [...campData.calendarEvents] : [];
    const normalized = normalizeMemberCalendarEvent(payload, nextCampEvents.length);
    if (!normalized) return null;

    nextCampEvents.push(normalized);
    nextCampEvents.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.name || '').localeCompare(String(b.name || '')));
    localStorage.setItem(CAMP_DATA_KEY, JSON.stringify({ ...campData, calendarEvents: nextCampEvents }));

    const dashboardEvents = Array.isArray(dashboard.calendarEvents) ? [...dashboard.calendarEvents] : [];
    dashboardEvents.push(normalized);
    dashboardEvents.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.title || a.name || '').localeCompare(String(b.title || b.name || '')));
    localStorage.setItem(DASHBOARD_KEY, JSON.stringify({ ...dashboard, calendarEvents: dashboardEvents, lastSaved: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }));
    return normalized;
  }

  function renderMemberCalendarForm() {
    const hostPanel = eventList.closest('.calendar-events-panel') || eventList.parentElement;
    if (!hostPanel || document.getElementById('memberCalendarForm')) return;

    const defaultName = getMemberEventDefaultName();
    const wrapper = document.createElement('div');
    wrapper.className = 'calendar-member-form-wrap';
    wrapper.innerHTML = `
      <div class="calendar-member-form">
        <strong>Add a camp event</strong>
        <p>Members can add a calendar entry for setup days, meals, work weekends, and other camp events.</p>
        <form id="memberCalendarForm" class="calendar-member-form-grid">
          <label>
            <span>Date</span>
            <input id="memberCalendarDate" type="date" required />
          </label>
          <label>
            <span>Added by</span>
            <input id="memberCalendarMember" type="text" placeholder="Camp Member" value="${defaultName.replace(/"/g, '&quot;')}" />
          </label>
          <label class="calendar-member-form-span-2">
            <span>Event title</span>
            <input id="memberCalendarTitle" type="text" placeholder="Final Setup" required />
          </label>
          <label class="calendar-member-form-span-2">
            <span>Details</span>
            <textarea id="memberCalendarDescription" rows="3" placeholder="Last stand/scouting details before bow opener."></textarea>
          </label>
          <div class="calendar-member-form-actions calendar-member-form-span-2">
            <button type="submit">Add Member Event</button>
          </div>
        </form>
        <div id="memberCalendarFeedback" class="calendar-member-feedback">New events save into this camp's calendar immediately.</div>
      </div>
    `;
    hostPanel.appendChild(wrapper);
    memberEventFeedback = wrapper.querySelector('#memberCalendarFeedback');
    const form = wrapper.querySelector('#memberCalendarForm');
    const dateInput = wrapper.querySelector('#memberCalendarDate');
    if (dateInput) dateInput.value = formatDateKey(new Date());

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const date = wrapper.querySelector('#memberCalendarDate').value;
      const member = wrapper.querySelector('#memberCalendarMember').value.trim();
      const title = wrapper.querySelector('#memberCalendarTitle').value.trim();
      const description = wrapper.querySelector('#memberCalendarDescription').value.trim();

      if (!date || !title) {
        setMemberEventFeedback('Add a date and event title before saving.', true);
        return;
      }

      const saved = saveMemberCalendarEvent({
        id: `member-event-${Date.now()}`,
        date,
        title,
        name: title,
        member,
        icon: '📝',
        type: 'camp',
        description,
        source: member ? `Added by ${member}` : 'Added by Camp Member',
        status: 'Active'
      });

      if (!saved) {
        setMemberEventFeedback('This event could not be saved.', true);
        return;
      }

      events = (Array.isArray(getCampData().calendarEvents) ? getCampData().calendarEvents : [])
        .filter((item) => item && item.date && (item.name || item.title))
        .map((item, index) => normalizeMemberCalendarEvent(item, index))
        .filter(Boolean);

      currentDate = new Date(`${saved.date}T00:00:00`);
      renderCalendar();
      renderEventList(saved.date);
      wrapper.querySelector('#memberCalendarTitle').value = '';
      wrapper.querySelector('#memberCalendarDescription').value = '';
      if (!wrapper.querySelector('#memberCalendarMember').value.trim()) {
        wrapper.querySelector('#memberCalendarMember').value = getMemberEventDefaultName();
      }
      setMemberEventFeedback(`${saved.title} was added to CampCalendar for ${humanDate(saved.date)}.`);
    });
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
      eventList.innerHTML = `<p>No camp calendar events this month.</p>`;
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
      eventList.innerHTML = `<p>No camp calendar events for this day.</p>`;
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
      eventList.innerHTML = `<p>No camp calendar events are loaded for this camp yet.</p>`;
    }

    renderCalendar();
    renderMemberCalendarForm();
  }

  loadEvents();
});