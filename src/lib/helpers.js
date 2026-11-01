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




