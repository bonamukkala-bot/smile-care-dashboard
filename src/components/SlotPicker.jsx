import { useMemo } from 'react'
import { Check, Clock } from 'lucide-react'
import {
  CLINIC_SLOTS,
  getTodayIST,
  isSlotInPast,
  formatISTDateLabel,
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
  const todayIST = getTodayIST()
  const isToday = selectedDate === todayIST

  // Filter out past slots for today
  const visibleSlots = useMemo(() => {
    return CLINIC_SLOTS.filter((slot) => {
      if (isToday) {
        return !isSlotInPast(selectedDate, slot.time)
      }
      return true
    })
  }, [isToday, selectedDate])

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

  if (loadingSlots) {
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
    const isTaken = takenSlots.has(slot.time)
    const isDisabled = disabled || isTaken || isCurrent
    const isSelected = selectedTime === slot.time

    let statusTag = null
    if (isCurrent) statusTag = 'Current'
    else if (isTaken) statusTag = 'Taken'

    return (
      <label
        key={slot.time}
        className={`slot-chip ${isSelected ? 'slot-chip-selected' : ''} ${
          isDisabled ? 'slot-chip-disabled' : ''
        }`}
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
          {statusTag && <span className="slot-status-tag">{statusTag}</span>}
        </span>
      </label>
    )
  }

  return (
    <div className="slot-picker-container" role="radiogroup" aria-label="Appointment time slot">
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
      {selectedTime && selectedSlotObj && (
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

