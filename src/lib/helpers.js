import { supabase } from './supabase'

/**
 * Shared helper functions for Smile Care Staff Dashboard
 */

/**
 * Format a timestamp into IST (Asia/Kolkata) like "Sun 1 Nov, 10:26 AM"
 */
export function formatIST(dateInput) {
  if (!dateInput) return '-'
  try {
    const date = new Date(dateInput)
    if (isNaN(date.getTime())) return '-'
    const str = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date)
    return str.replace(/\b(am|pm)\b/i, (m) => m.toUpperCase())
  } catch {
    return '-'
  }
}

/**
 * Format a timestamp into IST time with seconds like "10:26:18 AM"
 */
export function formatISTTime(dateInput) {
  if (!dateInput) return ''
  try {
    const date = new Date(dateInput)
    if (isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date)
  } catch {
    return ''
  }
}

/**
 * Format timestamp into YYYY-MM-DD in Asia/Kolkata for date picker comparison
 */
export function getISTDateKey(dateInput) {
  if (!dateInput) return ''
  try {
    const date = new Date(dateInput)
    if (isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return ''
  }
}

/**
 * Format seconds into a friendly duration like "1m 32s" or "45s"
 */
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '-'
  const num = Number(seconds)
  if (isNaN(num) || num < 0) return '-'
  if (num < 60) return `${num}s`
  const mins = Math.floor(num / 60)
  const secs = num % 60
  return `${mins}m ${secs}s`
}

/**
 * Resolve the patient's phone number without relying on variables.phone_number
 */
export function getPatientNumber(call) {
  if (!call) return '-'
  if (call.patient_number && String(call.patient_number).trim() !== '') {
    return String(call.patient_number).trim()
  }
  const direction = (call.direction || '').toLowerCase()
  if (direction === 'outbound') {
    return call.to_number ? String(call.to_number).trim() : '-'
  }
  return call.from_number ? String(call.from_number).trim() : '-'
}

/**
 * Mask phone number: keep country code and first 2 digits and last 3 digits,
 * hide the rest with bullets (e.g. +91 90••••• •929).
 */
export function maskPhone(phone) {
  if (!phone || phone === '-') return '-'
  const str = String(phone).trim()
  const digits = str.replace(/\D/g, '')
  if (digits.length < 6) return str

  let cc = ''
  let nat = digits

  if (str.startsWith('+91') || (digits.length === 12 && digits.startsWith('91'))) {
    cc = '+91'
    nat = digits.slice(-10)
  } else if (str.startsWith('+')) {
    const m = str.match(/^(\+\d{1,3})/)
    cc = m ? m[1] : ''
    nat = digits.slice(cc.length - 1)
  }

  const first2 = nat.slice(0, 2)
  const last3 = nat.slice(-3)
  const middleCount = Math.max(1, nat.length - 5)

  let maskedMiddle = '•'.repeat(middleCount)
  if (middleCount === 5) {
    maskedMiddle = '••••• •'
  }

  return (cc ? `${cc} ` : '') + first2 + maskedMiddle + last3
}

/**
 * Calculate the outcome tag based on required priority order:
 * 1. open emergency item -> "Emergency" (red)
 * 2. an appointment exists for the call -> "Booked" (green)
 * 3. appointment_action contains "cancel" -> "Cancel request" (orange)
 * 4. contains "reschedule" -> "Reschedule request" (orange)
 * 5. status is not "completed" -> "Call failed" (red)
 * 6. hangup_source is "user" and no appointment -> "Hung up" (orange)
 * 7. otherwise "Info only" (grey)
 */
export function getOutcome(call, appointment, attentionItems = []) {
  if (!call) return { label: 'Info only', color: 'grey' }

  const hasOpenEmergency = attentionItems.some(
    (item) => item.type === 'emergency' && item.status === 'open'
  )
  if (hasOpenEmergency) {
    return { label: 'Emergency', color: 'red' }
  }

  if (appointment) {
    return { label: 'Booked', color: 'green' }
  }

  const action = (call.variables?.appointment_action || '').toLowerCase()
  if (action.includes('cancel')) {
    return { label: 'Cancel request', color: 'orange' }
  }

  if (action.includes('reschedule')) {
    return { label: 'Reschedule request', color: 'orange' }
  }

  if (call.status && call.status !== 'completed') {
    return { label: 'Call failed', color: 'red' }
  }

  if (call.hangup_source === 'user' && !appointment) {
    return { label: 'Hung up', color: 'orange' }
  }

  return { label: 'Info only', color: 'grey' }
}

/**
 * Check if the call has any open attention items
 */
export function hasOpenAttention(attentionItems = []) {
  return attentionItems.some((item) => item.status === 'open')
}

/**
 * Format variable value: missing key or "NA" becomes "-"
 */
export function formatVariableValue(value) {
  if (value === undefined || value === null) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  const str = String(value).trim()
  if (str === '' || str.toUpperCase() === 'NA') return '-'
  return str
}

/**
 * Plain language label for attention item types
 */
export function formatAttentionType(type) {
  switch (type) {
    case 'emergency':
      return 'Emergency'
    case 'hung_up_midway':
      return 'Caller hung up midway'
    case 'booking_unconfirmed':
      return 'Booking not confirmed'
    case 'call_failed':
      return 'Call failed'
    case 'other':
      return 'Other'
    default:
      return type ? type.replace(/_/g, ' ') : 'Other'
  }
}

/**
 * Format waiting duration like "Waiting 3 h" or "Waiting 2 days"
 */
export function formatWaitTime(dateInput) {
  if (!dateInput) return '-'
  const time = new Date(dateInput).getTime()
  if (isNaN(time)) return '-'
  const diff = Math.max(0, Date.now() - time)
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (hours < 1) {
    return `Waiting ${Math.max(1, minutes)} m`
  }
  if (hours < 24) {
    return `Waiting ${hours} h`
  }
  return `Waiting ${days} ${days === 1 ? 'day' : 'days'}`
}

/**
 * Check if an item has been open for more than 24 hours
 */
export function isOpenOver24Hours(dateInput) {
  if (!dateInput) return false
  const time = new Date(dateInput).getTime()
  if (isNaN(time)) return false
  return Date.now() - time > 24 * 60 * 60 * 1000
}

/**
 * Format summary for attention card: first 120 chars followed by "..." or "No summary"
 */
export function formatSummary(summary) {
  if (!summary || typeof summary !== 'string' || summary.trim() === '') {
    return 'No summary'
  }
  const trimmed = summary.trim()
  if (trimmed.length <= 120) {
    return trimmed
  }
  return `${trimmed.slice(0, 120)}...`
}

/**
 * Get current date in IST as YYYY-MM-DD
 */
export function getTodayIST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * Get UTC range for a given IST date string (YYYY-MM-DD)
 * from 00:00:00 to 23:59:59.999 in IST
 */
export function getISTDateRange(dateStr) {
  const startUTC = new Date(`${dateStr}T00:00:00+05:30`).toISOString()
  const endUTC = new Date(`${dateStr}T23:59:59.999+05:30`).toISOString()
  return { startUTC, endUTC }
}

/**
 * Format IST date string like "Sun 1 Nov 2026"
 */
export function formatISTDateLabel(dateStr) {
  if (!dateStr) return '-'
  try {
    const d = new Date(`${dateStr}T12:00:00+05:30`)
    if (isNaN(d.getTime())) return dateStr
    const str = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d)
    return str.replace(/,/g, '')
  } catch {
    return dateStr
  }
}

/**
 * Format timestamp into short IST time like "11:00 AM"
 */
export function formatISTTimeShort(dateInput) {
  if (!dateInput) return '-'
  try {
    const date = new Date(dateInput)
    if (isNaN(date.getTime())) return '-'
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date)
  } catch {
    return '-'
  }
}

/**
 * Friendly label for appointment status
 */
export function formatAppointmentStatus(status) {
  switch (status) {
    case 'booked':
      return 'Booked'
    case 'confirmed':
      return 'Confirmed'
    case 'arrived':
      return 'Arrived'
    case 'completed':
      return 'Completed'
    case 'no_show':
      return 'No-show'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status ? status.replace(/_/g, ' ') : 'Booked'
  }
}

/**
 * Status color name mapping
 */
export function getAppointmentStatusColor(status) {
  switch (status) {
    case 'booked':
      return 'blue'
    case 'confirmed':
      return 'teal'
    case 'arrived':
      return 'purple'
    case 'completed':
      return 'green'
    case 'no_show':
      return 'orange'
    case 'cancelled':
      return 'grey'
    default:
      return 'blue'
  }
}

/**
 * Format 30-minute appointment slot range in IST like "10:00 AM - 10:30 AM"
 */
export function formatSlotRange(slotStart) {
  if (!slotStart) return '-'
  try {
    const start = new Date(slotStart)
    if (isNaN(start.getTime())) return '-'
    const end = new Date(start.getTime() + 30 * 60 * 1000)
    const fmt = (d) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(d)
    return `${fmt(start)} - ${fmt(end)}`
  } catch {
    return '-'
  }
}

/**
 * Calculate the 7 days (Monday to Sunday) of the week in IST for a given date string (YYYY-MM-DD)
 */
export function getISTWeekDays(dateStr) {
  try {
    const d = new Date(`${dateStr}T12:00:00+05:30`)
    if (isNaN(d.getTime())) return []
    const day = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
    const diffToMonday = (day === 0 ? 7 : day) - 1
    const monday = new Date(d)
    monday.setDate(d.getDate() - diffToMonday)

    const week = []
    for (let i = 0; i < 7; i++) {
      const cur = new Date(monday)
      cur.setDate(monday.getDate() + i)
      const key = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(cur)
      week.push(key)
    }
    return week
  } catch {
    return []
  }
}

/**
 * Format week label like "26 Oct – 1 Nov 2026"
 */
export function formatISTWeekLabel(monStr, sunStr) {
  if (!monStr || !sunStr) return ''
  try {
    const m = new Date(`${monStr}T12:00:00+05:30`)
    const s = new Date(`${sunStr}T12:00:00+05:30`)
    const mFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
    }).format(m)
    const sFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(s)
    return `${mFmt} – ${sFmt}`
  } catch {
    return `${monStr} – ${sunStr}`
  }
}

/**
 * Format relative time ago like "5m ago", "2h ago", "1d ago" or "just now"
 */
export function formatTimeAgo(dateInput) {
  if (!dateInput) return ''
  try {
    const time = new Date(dateInput).getTime()
    if (isNaN(time)) return ''
    const diff = Math.max(0, Date.now() - time)
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days === 1) return '1d ago'
    return `${days}d ago`
  } catch {
    return ''
  }
}

/**
 * 14 standard clinic slots (30 mins each, 10:00-13:00 and 17:00-20:00 IST)
 */
export const CLINIC_SLOTS = [
  { time: '10:00', label: '10:00 AM' },
  { time: '10:30', label: '10:30 AM' },
  { time: '11:00', label: '11:00 AM' },
  { time: '11:30', label: '11:30 AM' },
  { time: '12:00', label: '12:00 PM' },
  { time: '12:30', label: '12:30 PM' },
  { time: '13:00', label: '1:00 PM' },
  { time: '17:00', label: '5:00 PM' },
  { time: '17:30', label: '5:30 PM' },
  { time: '18:00', label: '6:00 PM' },
  { time: '18:30', label: '6:30 PM' },
  { time: '19:00', label: '7:00 PM' },
  { time: '19:30', label: '7:30 PM' },
  { time: '20:00', label: '8:00 PM' },
]

/**
 * Checks if a given YYYY-MM-DD in IST is Sunday
 */
export function isSundayIST(dateStr) {
  if (!dateStr) return false
  try {
    const d = new Date(`${dateStr}T12:00:00+05:30`)
    return d.getDay() === 0
  } catch {
    return false
  }
}

/**
 * Returns today's date in IST if not Sunday, or next Monday if today is Sunday
 */
export function getInitialBookingDate() {
  const today = getTodayIST()
  if (isSundayIST(today)) {
    const d = new Date(`${today}T12:00:00+05:30`)
    d.setDate(d.getDate() + 1)
    return getISTDateKey(d)
  }
  return today
}

/**
 * Returns true if a slot on dateStr is in the past
 */
export function isSlotInPast(dateStr, slotTime) {
  try {
    const slotDate = new Date(`${dateStr}T${slotTime}:00+05:30`)
    return slotDate.getTime() <= Date.now()
  } catch {
    return false
  }
}

/**
 * Extract HH:mm in IST from a timestamptz
 */
export function getISTSlotTime(dateInput) {
  if (!dateInput) return ''
  try {
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return ''
  }
}

/**
 * Format slot to ISO string with India offset, e.g. "2026-11-04T11:30:00+05:30"
 */
export function formatSlotStartISO(dateStr, slotTime) {
  return `${dateStr}T${slotTime}:00+05:30`
}

/**
 * Query non-cancelled appointments on dateStr to find taken slots
 */
export async function fetchTakenSlotsForDate(dateStr, excludeApptId = null) {
  if (!dateStr || isSundayIST(dateStr)) return new Set()
  try {
    const { startUTC, endUTC } = getISTDateRange(dateStr)
    const { data, error } = await supabase
      .from('appointments')
      .select('id, slot_start, status')
      .gte('slot_start', startUTC)
      .lte('slot_start', endUTC)
      .neq('status', 'cancelled')

    if (error) {
      console.error('Failed to fetch taken slots:', error.message)
      return new Set()
    }

    const taken = new Set()
    for (const appt of data || []) {
      if (excludeApptId && String(appt.id) === String(excludeApptId)) {
        continue
      }
      const timeStr = getISTSlotTime(appt.slot_start)
      if (timeStr) {
        taken.add(timeStr)
      }
    }
    return taken
  } catch (err) {
    console.error('Error in fetchTakenSlotsForDate:', err)
    return new Set()
  }
}

/**
 * Invoke the manage-appointment Supabase Edge Function
 */
export async function invokeManageAppointment(body) {
  try {
    const { data, error } = await supabase.functions.invoke('manage-appointment', {
      body,
    })

    if (error) {
      let friendlyMessage = 'Something went wrong. Please try again.'
      try {
        if (error.context && typeof error.context.json === 'function') {
          const bodyJson = await error.context.json()
          if (bodyJson && bodyJson.error) {
            friendlyMessage = bodyJson.error
          }
        } else if (error.message) {
          friendlyMessage = error.message
        }
      } catch {
        // Fallback to default message
      }
      return { ok: false, error: friendlyMessage }
    }

    if (!data || data.ok === false) {
      return {
        ok: false,
        error: data?.error || 'Something went wrong. Please try again.',
        code: data?.code,
      }
    }

    return { ok: true, data }
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Something went wrong. Please try again.',
    }
  }
}

/**
 * Invoke the manage-closure Supabase Edge Function
 */
export async function invokeManageClosure(body) {
  try {
    const { data, error } = await supabase.functions.invoke('manage-closure', {
      body,
    })

    if (error) {
      let friendlyMessage = 'Something went wrong. Please try again.'
      try {
        if (error.context && typeof error.context.json === 'function') {
          const bodyJson = await error.context.json()
          if (bodyJson && bodyJson.error) {
            friendlyMessage = bodyJson.error
          }
        } else if (error.message) {
          friendlyMessage = error.message
        }
      } catch {
        // Fallback to default message
      }
      return { ok: false, error: friendlyMessage }
    }

    if (!data || data.ok === false) {
      return {
        ok: false,
        error: data?.error || 'Something went wrong. Please try again.',
        code: data?.code,
      }
    }

    return { ok: true, data }
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Something went wrong. Please try again.',
    }
  }
}

/**
 * Format closure reason to plain English label:
 * doctor_leave: "Doctor on leave"
 * event: "Doctor at an event"
 * emergency: "Emergency"
 * holiday: "Holiday"
 * other: "Other"
 */
export function formatClosureReason(reason) {
  switch (reason) {
    case 'doctor_leave':
      return 'Doctor on leave'
    case 'event':
      return 'Doctor at an event'
    case 'emergency':
      return 'Emergency'
    case 'holiday':
      return 'Holiday'
    case 'other':
      return 'Other'
    default:
      return reason ? reason.replace(/_/g, ' ') : 'Closure'
  }
}

/**
 * Convert 24-hour HH:MM time string to 12-hour format like "10:00 AM" or "2:30 PM"
 */
export function formatTime24To12(time24) {
  if (!time24) return ''
  const [hStr, mStr] = time24.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr || '0', 10)
  if (isNaN(h)) return time24
  const hour12 = h % 12 === 0 ? 12 : h % 12
  const ampm = h >= 12 ? 'PM' : 'AM'
  const mPad = m < 10 ? `0${m}` : `${m}`
  return `${hour12}:${mPad} ${ampm}`
}

/**
 * Format closure time window:
 * "Full day" when it starts 10:00 AM and ends 8:30 PM (or spans across days)
 * "From 2:30 PM until 8:30 PM" when it starts later than 10:00 AM and ends 8:30 PM
 * Otherwise "2:00 PM to 4:00 PM"
 */
export function formatClosureWindow(startAt, endAt) {
  if (!startAt || !endAt) return '-'
  try {
    const startDateKey = getISTDateKey(startAt)
    const endDateKey = getISTDateKey(endAt)
    const isSameDay = startDateKey === endDateKey

    const startParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(startAt))

    const endParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(endAt))

    const startH = parseInt(startParts.find((p) => p.type === 'hour')?.value || '0', 10)
    const startM = parseInt(startParts.find((p) => p.type === 'minute')?.value || '0', 10)
    const endH = parseInt(endParts.find((p) => p.type === 'hour')?.value || '0', 10)
    const endM = parseInt(endParts.find((p) => p.type === 'minute')?.value || '0', 10)

    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    const isFullDayStart = startMinutes <= 600 // 10:00 AM or earlier
    const isFullDayEnd = endMinutes >= 1230 // 20:30 (8:30 PM) or later

    if (!isSameDay) {
      if (isFullDayStart && isFullDayEnd) return 'Full day'
      return `${formatISTTimeShort(startAt)} to ${formatISTTimeShort(endAt)}`
    }

    if (isFullDayStart && isFullDayEnd) {
      return 'Full day'
    }

    if (!isFullDayStart && isFullDayEnd) {
      return `From ${formatISTTimeShort(startAt)} until 8:30 PM`
    }

    return `${formatISTTimeShort(startAt)} to ${formatISTTimeShort(endAt)}`
  } catch {
    return '-'
  }
}

/**
 * Format closure date range in IST:
 * Same day: "Wed 4 Nov 2026"
 * Several days: "Mon 9 Nov to Fri 13 Nov 2026"
 */
export function formatClosureDateRange(startAt, endAt) {
  if (!startAt) return '-'
  try {
    const startD = new Date(startAt)
    const endD = endAt ? new Date(endAt) : startD
    const startDateKey = getISTDateKey(startD)
    const endDateKey = getISTDateKey(endD)

    const fmt = (d, includeYear = true) => {
      const opts = {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }
      if (includeYear) opts.year = 'numeric'
      return new Intl.DateTimeFormat('en-GB', opts).format(d).replace(/,/g, '')
    }

    if (startDateKey === endDateKey) {
      return fmt(startD, true)
    }

    const startYear = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(startD)
    const endYear = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(endD)

    if (startYear === endYear) {
      return `${fmt(startD, false)} to ${fmt(endD, true)}`
    }
    return `${fmt(startD, true)} to ${fmt(endD, true)}`
  } catch {
    return '-'
  }
}

/**
 * Get next half hour in IST from right now as 'HH:MM' (24-hour).
 * If before 10:00, returns '10:00'. If past 20:30, returns '20:30'.
 */
export function getNextHalfHourIST() {
  try {
    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now)
    let hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10)
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10)

    let nextMinute = 0
    if (minute > 0 && minute <= 30) {
      nextMinute = 30
    } else if (minute > 30) {
      hour += 1
      nextMinute = 0
    }
    if (hour < 10) {
      hour = 10
      nextMinute = 0
    }
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(hour)}:${pad(nextMinute)}`
  } catch {
    return '10:00'
  }
}

/**
 * Check if "Close the rest of today" quick chip should be visible.
 * Hidden if today is Sunday or current IST time is already 8:00 PM (20:00) or later.
 */
export function canCloseRestOfToday() {
  try {
    const today = getTodayIST()
    if (isSundayIST(today)) return false

    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now)
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10)
    if (hour >= 20) return false
    return true
  } catch {
    return false
  }
}

/**
 * Add days to an IST date string (YYYY-MM-DD) and return YYYY-MM-DD
 */
export function addDaysToISTDate(dateStr, days) {
  try {
    const d = new Date(`${dateStr}T12:00:00+05:30`)
    d.setDate(d.getDate() + days)
    return getISTDateKey(d)
  } catch {
    return dateStr
  }
}

/**
 * Live clinic operating status in Asia/Kolkata timezone:
 * Mon-Sat: 10:00 AM-1:30 PM & 5:00-8:30 PM. Break: 1:30-5:00 PM. Sunday: closed.
 */
export function getClinicStatusIST() {
  try {
    const now = new Date()
    const dayStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
    }).format(now)

    if (dayStr === 'Sun') {
      return { status: 'Closed', color: 'muted' }
    }

    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now)

    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10)
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10)
    const mins = hour * 60 + minute

    if (mins >= 600 && mins < 810) {
      return { status: 'Open now', color: 'green' }
    }
    if (mins >= 810 && mins < 1020) {
      return { status: 'On break', color: 'amber' }
    }
    if (mins >= 1020 && mins < 1230) {
      return { status: 'Open now', color: 'green' }
    }
    return { status: 'Closed', color: 'muted' }
  } catch {
    return { status: 'Closed', color: 'muted' }
  }
}

/**
 * Format today's date in IST like "Sunday, 1 November 2026"
 */
export function getISTLongDate() {
  try {
    const now = new Date()
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now)
  } catch {
    return ''
  }
}

/**
 * Format doctor name, normalizing leading "Dr." or "Dr" prefixes (case-insensitive, repeated),
 * returning "Dr. <rest>". Returns "Doctor" for empty or missing values.
 */
export function formatDoctorName(name) {
  if (!name || typeof name !== 'string') return 'Doctor'
  const trimmed = name.trim()
  if (!trimmed) return 'Doctor'
  if (trimmed.toLowerCase() === 'doctor') return 'Doctor'

  // Remove leading Dr. or Dr (repeated) with whitespace and dots
  const stripped = trimmed.replace(/^(dr\.?\s*)+/i, '').trim()
  if (!stripped || stripped.toLowerCase() === 'doctor') {
    return 'Doctor'
  }
  return `Dr. ${stripped}`
}

/**
 * Format 30-minute slot end time in IST (e.g., "11:30 AM")
 */
export function formatSlotEndTime(slotStart) {
  if (!slotStart) return ''
  try {
    const start = new Date(slotStart)
    if (isNaN(start.getTime())) return ''
    const end = new Date(start.getTime() + 30 * 60 * 1000)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(end)
  } catch {
    return ''
  }
}

/**
 * Format plain IST date-time strings (like "2026-11-03 11:00:00" or "2026-11-03T11:00")
 * directly by parsing date and time components WITHOUT timezone shifts (e.g. "Tue 3 Nov, 11:00 AM").
 * If parsing fails, returns original string. "NA" or empty returns "-".
 */
export function formatPlainISTDateTime(val) {
  if (!val || typeof val !== 'string') return '-'
  const str = val.trim()
  if (!str || str.toUpperCase() === 'NA') return '-'

  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (match) {
    const year = parseInt(match[1], 10)
    const monthIndex = parseInt(match[2], 10) - 1
    const day = parseInt(match[3], 10)
    const hasTime = match[4] !== undefined
    const hour24 = hasTime ? parseInt(match[4], 10) : 0
    const minute = hasTime ? parseInt(match[5], 10) : 0

    const utcDate = new Date(Date.UTC(year, monthIndex, day, hour24, minute))
    if (isNaN(utcDate.getTime())) return str

    const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' }).format(utcDate)
    const dayNum = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric' }).format(utcDate)
    const monthStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'short' }).format(utcDate)

    if (!hasTime) {
      return `${weekday} ${dayNum} ${monthStr}`
    }

    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
    const ampm = hour24 >= 12 ? 'PM' : 'AM'
    const minutePad = minute < 10 ? `0${minute}` : `${minute}`

    return `${weekday} ${dayNum} ${monthStr}, ${hour12}:${minutePad} ${ampm}`
  }
  return str
}

/**
 * Get first character of caller name supporting Telugu / multi-byte scripts safely via Array.from().
 * Returns null if no usable character or unknown caller.
 */
export function getAvatarFirstChar(name) {
  if (!name || typeof name !== 'string') return null
  const trimmed = name.trim()
  if (!trimmed || trimmed.toLowerCase() === 'unknown caller') return null
  const chars = Array.from(trimmed)
  return chars[0] || null
}
