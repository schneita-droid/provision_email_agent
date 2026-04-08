import { getAccessToken, isAuthenticated } from './gmail'

/**
 * Fetch calendar events for a time range
 */
export async function fetchEvents(timeMin, timeMax, calendarId = 'primary') {
  if (!isAuthenticated()) return getDemoEvents()

  const token = getAccessToken()
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })

  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!resp.ok) throw new Error('Kalenteritapahtumien haku epäonnistui')

  const data = await resp.json()
  return (data.items || []).map(event => ({
    id: event.id,
    summary: event.summary || '(ei otsikkoa)',
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    allDay: !event.start?.dateTime,
  }))
}

/**
 * Fetch free/busy info for one or more calendars
 * calendarIds: array of email addresses (e.g. ['me@gmail.com', 'colleague@gmail.com'])
 */
export async function fetchFreeSlots(timeMin, timeMax, calendarIds = ['primary']) {
  if (!isAuthenticated()) return getDemoFreeSlots(timeMin, timeMax)

  const token = getAccessToken()
  const resp = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: calendarIds.map(id => ({ id })),
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    console.error('FreeBusy error:', resp.status, err)
    throw new Error('Vapaiden aikojen haku epäonnistui')
  }

  const data = await resp.json()
  console.log(`FreeBusy: ${timeMin.toISOString()} - ${timeMax.toISOString()}, busy periods:`, Object.entries(data.calendars || {}).map(([id, info]) => `${id}: ${info.busy?.length || 0} busy`).join(', '))

  // Extract busy periods per calendar
  const busyByCalendar = {}
  for (const [calId, info] of Object.entries(data.calendars || {})) {
    busyByCalendar[calId] = (info.busy || []).map(b => ({
      start: new Date(b.start),
      end: new Date(b.end),
    }))
  }

  // Calculate common free slots (working hours 8-17)
  return findFreeSlots(busyByCalendar, timeMin, timeMax)
}

/**
 * Find free slots from busy periods (working hours 8:00-17:00)
 */
function findFreeSlots(busyByCalendar, timeMin, timeMax) {
  // Merge all busy periods across calendars
  const allBusy = []
  for (const periods of Object.values(busyByCalendar)) {
    allBusy.push(...periods)
  }
  allBusy.sort((a, b) => a.start - b.start)

  // Merge overlapping busy periods
  const merged = []
  for (const period of allBusy) {
    if (merged.length && period.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = new Date(Math.max(merged[merged.length - 1].end, period.end))
    } else {
      merged.push({ start: new Date(period.start), end: new Date(period.end) })
    }
  }

  // Generate free slots within working hours
  const free = []
  const current = new Date(timeMin)
  const end = new Date(timeMax)

  while (current < end) {
    const dayStart = new Date(current)
    dayStart.setHours(8, 0, 0, 0)
    const dayEnd = new Date(current)
    dayEnd.setHours(17, 0, 0, 0)

    // Skip weekends
    const dow = current.getDay()
    if (dow === 0 || dow === 6) {
      current.setDate(current.getDate() + 1)
      current.setHours(0, 0, 0, 0)
      continue
    }

    // Find free windows in this workday
    let windowStart = dayStart < timeMin ? new Date(timeMin) : dayStart

    for (const busy of merged) {
      if (busy.end <= dayStart || busy.start >= dayEnd) continue
      const busyStart = busy.start < dayStart ? dayStart : busy.start
      if (windowStart < busyStart) {
        free.push({
          start: new Date(windowStart),
          end: new Date(busyStart),
          date: formatDate(windowStart),
          timeRange: `${formatTime(windowStart)}–${formatTime(busyStart)}`,
          durationMin: Math.round((busyStart - windowStart) / 60000),
        })
      }
      windowStart = busy.end > windowStart ? new Date(busy.end) : windowStart
    }

    if (windowStart < dayEnd) {
      free.push({
        start: new Date(windowStart),
        end: new Date(dayEnd),
        date: formatDate(windowStart),
        timeRange: `${formatTime(windowStart)}–${formatTime(dayEnd)}`,
        durationMin: Math.round((dayEnd - windowStart) / 60000),
      })
    }

    current.setDate(current.getDate() + 1)
    current.setHours(0, 0, 0, 0)
  }

  // Filter out very short slots (< 30 min)
  return free.filter(s => s.durationMin >= 30)
}

function formatDate(d) {
  return d.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })
}

function formatTime(d) {
  return d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Format free slots as readable text for AI context
 */
export function formatFreeSlotsText(slots) {
  if (!slots.length) return 'Ei vapaita aikoja lähipäivinä.'

  const byDate = {}
  for (const slot of slots) {
    if (!byDate[slot.date]) byDate[slot.date] = []
    byDate[slot.date].push(slot.timeRange)
  }

  return Object.entries(byDate)
    .map(([date, times]) => `${date}: ${times.join(', ')}`)
    .join('\n')
}

/**
 * Demo data when not authenticated
 */
function getDemoEvents() {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  return [
    { id: 'd1', summary: 'Tiimikokous', start: setTime(today, 9, 0), end: setTime(today, 10, 0), allDay: false },
    { id: 'd2', summary: 'Lounas Mikan kanssa', start: setTime(today, 11, 30), end: setTime(today, 12, 30), allDay: false },
    { id: 'd3', summary: 'Sprint planning', start: setTime(today, 14, 0), end: setTime(today, 15, 0), allDay: false },
    { id: 'd4', summary: 'Asiakastapaaminen', start: setTime(tomorrow, 10, 0), end: setTime(tomorrow, 11, 0), allDay: false },
  ]
}

function getDemoFreeSlots(timeMin, timeMax) {
  const slots = []
  const start = timeMin ? new Date(timeMin) : new Date()
  const end = timeMax ? new Date(timeMax) : new Date(start.getTime() + 7 * 86400000)

  // Simulate some busy slots per day to make it realistic
  const busyPatterns = [
    [{ h: 9, m: 0, dur: 60 }, { h: 11, m: 30, dur: 60 }, { h: 14, m: 0, dur: 60 }],
    [{ h: 10, m: 0, dur: 60 }],
    [{ h: 9, m: 0, dur: 90 }, { h: 13, m: 0, dur: 120 }],
    [{ h: 8, m: 0, dur: 60 }, { h: 11, m: 0, dur: 60 }, { h: 15, m: 0, dur: 60 }],
    [{ h: 10, m: 0, dur: 120 }],
  ]

  const current = new Date(start)
  current.setHours(0, 0, 0, 0)

  while (current < end) {
    const dow = current.getDay()
    if (dow === 0 || dow === 6) { current.setDate(current.getDate() + 1); continue }

    const pattern = busyPatterns[current.getDate() % busyPatterns.length]
    const dayStart = new Date(current); dayStart.setHours(8, 0, 0, 0)
    const dayEnd = new Date(current); dayEnd.setHours(17, 0, 0, 0)

    let windowStart = dayStart
    for (const busy of pattern) {
      const busyStart = new Date(current); busyStart.setHours(busy.h, busy.m, 0, 0)
      const busyEnd = new Date(busyStart.getTime() + busy.dur * 60000)
      if (windowStart < busyStart) {
        const durMin = Math.round((busyStart - windowStart) / 60000)
        if (durMin >= 30) {
          slots.push({
            start: new Date(windowStart), end: new Date(busyStart),
            date: formatDate(windowStart), timeRange: `${formatTime(windowStart)}–${formatTime(busyStart)}`,
            durationMin: durMin,
          })
        }
      }
      windowStart = busyEnd > windowStart ? busyEnd : windowStart
    }
    if (windowStart < dayEnd) {
      const durMin = Math.round((dayEnd - windowStart) / 60000)
      if (durMin >= 30) {
        slots.push({
          start: new Date(windowStart), end: new Date(dayEnd),
          date: formatDate(windowStart), timeRange: `${formatTime(windowStart)}–${formatTime(dayEnd)}`,
          durationMin: durMin,
        })
      }
    }

    current.setDate(current.getDate() + 1)
  }

  return slots
}

function setTime(date, h, m) {
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
