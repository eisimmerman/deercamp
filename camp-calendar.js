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
  const DASHBOARD_KEY = "deerCampStewardDashboard";
  const MEMBER_INVITE_KEY = "deerCampMemberInvite";
  let memberEventFeedback = null;

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
    renderMemberCalendarForm();
  }

  loadEvents();
});