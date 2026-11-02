import { useState, useEffect, useMemo } from 'react'
import { Check, Clock, CalendarOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  CLINIC_SLOTS,
  getTodayIST,
  isSlotInPast,
  formatISTDateLabel,
  isSundayIST,
  getISTDateRange,
  formatClosureReason,
} from '../lib/helpers'

export default function SlotPicker({
  selectedDate,
  selectedTime,
  onSelectTime,
  takenSlots = new Set(),
  currentSlotTime = null,
  isCurrentDate = false,
  loadingSlots = false,
  disabled = false,
}) {
  const [activeClosures, setActiveClosures] = useState([])
  const [loadingClosures, setLoadingClosures] = useState(false)

  const todayIST = getTodayIST()
  const isToday = selectedDate === todayIST

  // Fetch active closures overlapping selectedDate
  useEffect(() => {
    let isMounted = true

    async function loadClosuresForDate() {
      if (!selectedDate || isSundayIST(selectedDate)) {
        return
      }

      try {
        const { startUTC, endUTC } = getISTDateRange(selectedDate)
        const { data, error } = await supabase
          .from('closures')
          .select('id, start_at, end_at, reason, note, status')
          .eq('status', 'active')
          .lt('start_at', endUTC)
          .gt('end_at', startUTC)

        if (!isMounted) return
        if (error) {
          console.error('Failed to load closures in SlotPicker:', error.message)
          setActiveClosures([])
        } else {
          setActiveClosures(data || [])
        }
      } catch (err) {
        console.error('Error fetching closures for SlotPicker:', err)
        if (isMounted) setActiveClosures([])
      } finally {
        if (isMounted) setLoadingClosures(false)
      }
    }

    loadClosuresForDate()

    return () => {
      isMounted = false
    }
  }, [selectedDate])

  // Filter out past slots for today
  const visibleSlots = useMemo(() => {
    return CLINIC_SLOTS.filter((slot) => {
      if (isToday) {
        return !isSlotInPast(selectedDate, slot.time)
      }
      return true
    })
  }, [isToday, selectedDate])

  // Map closed slot times -> reason label
  const closedSlotsMap = useMemo(() => {
    if (!activeClosures || activeClosures.length === 0 || !selectedDate || isSundayIST(selectedDate)) {
      return new Map()
    }
    const map = new Map()
    for (const slot of CLINIC_SLOTS) {
      try {
        const slotTimeMs = new Date(`${selectedDate}T${slot.time}:00+05:30`).getTime()
        for (const cl of activeClosures) {
          const startMs = new Date(cl.start_at).getTime()
          const endMs = new Date(cl.end_at).getTime()
          if (slotTimeMs >= startMs && slotTimeMs < endMs) {
            map.set(slot.time, formatClosureReason(cl.reason))
            break
          }
        }
      } catch {
        // Ignore single slot date parse errors
      }
    }
    return map
  }, [activeClosures, selectedDate])

  // Check if ALL clinic slots for the entire day are closed
  const isAllDayClosed = useMemo(() => {
    if (CLINIC_SLOTS.length === 0) return false
    return CLINIC_SLOTS.every((s) => closedSlotsMap.has(s.time))
  }, [closedSlotsMap])

  const allDayClosedReason = useMemo(() => {
    if (!isAllDayClosed) return ''
    const firstReason = closedSlotsMap.values().next().value
    return firstReason || 'Clinic closed'
  }, [isAllDayClosed, closedSlotsMap])

  // If currently selected slot is closed, clear it via deferred timer
  useEffect(() => {
    if (selectedTime && closedSlotsMap.has(selectedTime)) {
      const timer = setTimeout(() => {
        onSelectTime?.('')
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [selectedTime, closedSlotsMap, onSelectTime])

  const morningSlots = useMemo(
    () => visibleSlots.filter((s) => s.time <= '13:00'),
    [visibleSlots]
  )
  const eveningSlots = useMemo(
    () => visibleSlots.filter((s) => s.time >= '17:00'),
    [visibleSlots]
  )

  const selectedSlotObj = useMemo(
    () => CLINIC_SLOTS.find((s) => s.time === selectedTime),
    [selectedTime]
  )

  const formattedDate = formatISTDateLabel(selectedDate)

  if (loadingSlots || loadingClosures) {
    return (
      <div className="slot-loading-state" role="status" aria-live="polite">
        <Clock size={18} className="spinner-inline" aria-hidden="true" />
        <span>Checking available time slots...</span>
      </div>
    )
  }

  if (visibleSlots.length === 0) {
    return (
      <div className="slot-empty-notice" role="alert">
        <Clock size={18} aria-hidden="true" />
        <span>No remaining slots available today. Please choose a future date.</span>
      </div>
    )
  }

  const renderSlotChip = (slot) => {
    const isCurrent = isCurrentDate && currentSlotTime === slot.time
    const isClosed = closedSlotsMap.has(slot.time)
    const isTaken = !isClosed && takenSlots.has(slot.time)
    const isDisabled = disabled || isClosed || isTaken || isCurrent
    const isSelected = selectedTime === slot.time && !isClosed

    let statusTag = null
    let statusIcon = null
    if (isCurrent) {
      statusTag = 'Current'
    } else if (isClosed) {
      statusTag = 'Closed'
      statusIcon = <CalendarOff size={12} className="slot-tag-icon" aria-hidden="true" />
    } else if (isTaken) {
      statusTag = 'Taken'
    }

    return (
      <label
        key={slot.time}
        className={`slot-chip ${isSelected ? 'slot-chip-selected' : ''} ${
          isDisabled ? 'slot-chip-disabled' : ''
        } ${isClosed ? 'slot-chip-closed' : ''}`}
      >
        <input
          type="radio"
          name="slot-radio-group"
          value={slot.time}
          checked={isSelected}
          disabled={isDisabled}
          onChange={() => onSelectTime(slot.time)}
          className="slot-radio-native"
          aria-label={`${slot.label}${statusTag ? ` (${statusTag})` : ''}`}
        />
        <span className="slot-chip-inner">
          {isSelected && <Check size={14} className="slot-check-icon" aria-hidden="true" />}
          <span className="slot-time-text">{slot.label}</span>
          {statusTag && (
            <span
              className={`slot-status-tag ${
                isClosed ? 'slot-status-closed' : isTaken ? 'slot-status-taken' : ''
              }`}
            >
              {statusIcon}
              <span>{statusTag}</span>
            </span>
          )}
        </span>
      </label>
    )
  }

  return (
    <div className="slot-picker-container" role="radiogroup" aria-label="Appointment time slot">
      {/* Notice if ALL clinic slots for this day are closed */}
      {isAllDayClosed && (
        <div className="slot-all-closed-banner" role="alert">
          <CalendarOff size={18} className="slot-closed-banner-icon" aria-hidden="true" />
          <span>The clinic is closed on this day ({allDayClosedReason}).</span>
        </div>
      )}

      {/* Morning Section */}
      {morningSlots.length > 0 && (
        <div className="slot-group">
          <div className="slot-group-header">
            <span className="slot-group-title">Morning</span>
            <span className="slot-group-subtitle">10:00 AM – 1:00 PM</span>
          </div>
          <div className="slot-chip-grid">
            {morningSlots.map(renderSlotChip)}
          </div>
        </div>
      )}

      {/* Evening Section */}
      {eveningSlots.length > 0 && (
        <div className="slot-group">
          <div className="slot-group-header">
            <span className="slot-group-title">Evening</span>
            <span className="slot-group-subtitle">5:00 PM – 8:00 PM</span>
          </div>
          <div className="slot-chip-grid">
            {eveningSlots.map(renderSlotChip)}
          </div>
        </div>
      )}

      {/* Selection summary */}
      {selectedTime && selectedSlotObj && !closedSlotsMap.has(selectedTime) && (
        <div className="slot-selection-summary" aria-live="polite">
          <span className="selection-summary-label">Selected:</span>{' '}
          <strong className="selection-summary-value">
            {formattedDate}, {selectedSlotObj.label}
          </strong>
        </div>
      )}
    </div>
  )
}
