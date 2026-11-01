import { useState, useEffect } from 'react'
import {
  CLINIC_SLOTS,
  getTodayIST,
  isSundayIST,
  getInitialBookingDate,
  isSlotInPast,
  formatSlotStartISO,
  getISTDateKey,
  getISTSlotTime,
  formatISTDateLabel,
  fetchTakenSlotsForDate,
  invokeManageAppointment,
} from '../lib/helpers'

export default function MoveBookingModal({ isOpen, onClose, onSuccess, appointment }) {
  const [selectedDate, setSelectedDate] = useState(() => getInitialBookingDate())
  const [selectedTime, setSelectedTime] = useState('')
  const [step, setStep] = useState('select') // 'select' | 'confirm'

  const [takenSlots, setTakenSlots] = useState(new Set())
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState(null)

  const todayIST = getTodayIST()
  const isSunday = isSundayIST(selectedDate)

  // Current appointment details
  const currentSlotStart = appointment?.slot_start
  const currentDateKey = getISTDateKey(currentSlotStart)
  const currentSlotTime = getISTSlotTime(currentSlotStart)

  // Fetch taken slots when date changes (excluding this appointment itself)
  useEffect(() => {
    let isMounted = true

    fetchTakenSlotsForDate(selectedDate, appointment?.id).then((taken) => {
      if (isMounted) {
        setTakenSlots(taken)
        setLoadingSlots(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [selectedDate, appointment?.id])

  if (!isOpen || !appointment) return null

  // Filter slots for today: hide times that already passed
  const visibleSlots = CLINIC_SLOTS.filter((slot) => {
    if (selectedDate === todayIST) {
      return !isSlotInPast(selectedDate, slot.time)
    }
    return true
  })

  // Check if slot is the current appointment's slot
  const isCurrentSlot = (slotTime) => {
    return selectedDate === currentDateKey && slotTime === currentSlotTime
  }

  const selectedSlotObj = CLINIC_SLOTS.find((s) => s.time === selectedTime)
  const targetLabel = selectedSlotObj ? selectedSlotObj.label : selectedTime
  const targetDateLabel = formatISTDateLabel(selectedDate)

  const handleDateChange = (e) => {
    const val = e.target.value
    setSelectedDate(val)
    setSelectedTime('')
    setLoadingSlots(true)
    setModalError(null)
  }

  const handleProceedToConfirm = (e) => {
    e.preventDefault()
    setModalError(null)

    if (!selectedDate) {
      setModalError('Please pick a date.')
      return
    }

    if (isSunday) {
      setModalError('Clinic is closed on Sundays (Mon-Sat only).')
      return
    }

    if (selectedDate < todayIST) {
      setModalError('Cannot reschedule to a past date.')
      return
    }

    if (!selectedTime) {
      setModalError('Please select a new time slot.')
      return
    }

    if (isCurrentSlot(selectedTime)) {
      setModalError('This is the current booking time. Please pick a different slot.')
      return
    }

    if (takenSlots.has(selectedTime)) {
      setModalError('This slot is already taken. Please choose another time.')
      return
    }

    if (selectedDate === todayIST && isSlotInPast(selectedDate, selectedTime)) {
      setModalError('This time has already passed. Please select an upcoming slot.')
      return
    }

    setStep('confirm')
  }

  const handleExecuteReschedule = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setModalError(null)

    const newSlotStartISO = formatSlotStartISO(selectedDate, selectedTime)
    const payload = {
      action: 'reschedule',
      appointment_id: Number(appointment.id),
      new_slot_start: newSlotStartISO,
    }

    const res = await invokeManageAppointment(payload)

    if (res.ok) {
      setIsSubmitting(false)
      onSuccess(`Booking moved to ${targetDateLabel}, ${targetLabel}`)
      onClose()
    } else {
      setIsSubmitting(false)
      setStep('select')
      setModalError(res.error || 'Could not move booking. Please try again.')
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-booking-title"
    >
      <div className="modal-content">
        <header className="modal-header">
          <h2 id="move-booking-title" className="modal-title">
            Move Appointment to Another Time
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-modal-close"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </header>

        {modalError && (
          <div className="alert alert-error" role="alert">
            {modalError}
          </div>
        )}

        {/* Current Booking Summary */}
        <div className="current-booking-box">
          <span className="current-booking-label">Patient:</span>
          <strong className="current-booking-value">
            {appointment.patient_name || 'Patient'}
          </strong>
          <span className="current-booking-label">Current slot:</span>
          <span className="current-booking-value">
            {formatISTDateLabel(currentDateKey)} at{' '}
            {CLINIC_SLOTS.find((s) => s.time === currentSlotTime)?.label || currentSlotTime}
          </span>
        </div>

        {step === 'select' ? (
          <form onSubmit={handleProceedToConfirm} className="booking-modal-form">
            {/* Date Picker */}
            <div className="booking-form-group">
              <label htmlFor="move-date-input" className="booking-form-label">
                New Date <span className="required-star">*</span>
              </label>
              <input
                id="move-date-input"
                type="date"
                min={todayIST}
                value={selectedDate}
                onChange={handleDateChange}
                disabled={isSubmitting}
                className="booking-form-input date-input"
                required
              />
              {isSunday && (
                <p className="form-field-warning">
                  ⚠️ Clinic is closed on Sundays (Mon-Sat only). Please choose another day.
                </p>
              )}
            </div>

            {/* Time Slot Dropdown */}
            {!isSunday && (
              <div className="booking-form-group">
                <label htmlFor="move-time-select" className="booking-form-label">
                  New Time Slot (IST) <span className="required-star">*</span>
                </label>

                {loadingSlots ? (
                  <div className="slot-loading-hint">Checking available slots...</div>
                ) : visibleSlots.length === 0 ? (
                  <p className="form-field-warning">
                    No slots remaining today. Please select a future date.
                  </p>
                ) : (
                  <select
                    id="move-time-select"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    disabled={isSubmitting}
                    className="booking-form-select"
                    required
                  >
                    <option value="">-- Choose a new time slot --</option>
                    {visibleSlots.map((slot) => {
                      const isCurrent = isCurrentSlot(slot.time)
                      const isTaken = takenSlots.has(slot.time)
                      const isDisabled = isCurrent || isTaken

                      let suffix = ''
                      if (isCurrent) suffix = ' (Current slot)'
                      else if (isTaken) suffix = ' (Taken)'

                      return (
                        <option
                          key={slot.time}
                          value={slot.time}
                          disabled={isDisabled}
                        >
                          {slot.label}
                          {suffix}
                        </option>
                      )
                    })}
                  </select>
                )}
              </div>
            )}

            <div className="modal-actions-row">
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  isSunday ||
                  loadingSlots ||
                  !selectedTime ||
                  isCurrentSlot(selectedTime) ||
                  takenSlots.has(selectedTime)
                }
                className="btn btn-primary btn-submit-booking"
              >
                Proceed to Confirm →
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="btn btn-secondary btn-cancel-modal"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Confirm Step */
          <div className="reschedule-confirm-box" role="alert">
            <p className="confirm-prompt-title">Move this booking to:</p>
            <p className="confirm-target-slot-text">
              <strong>{targetDateLabel}</strong> at <strong>{targetLabel}</strong>?
            </p>
            <p className="confirm-hint-text">
              This will update the appointment on Google Calendar.
            </p>

            <div className="confirm-btn-row">
              <button
                type="button"
                onClick={handleExecuteReschedule}
                disabled={isSubmitting}
                className="btn btn-primary btn-confirm-yes"
              >
                {isSubmitting ? 'Moving booking...' : 'Yes, move booking'}
              </button>
              <button
                type="button"
                onClick={() => setStep('select')}
                disabled={isSubmitting}
                className="btn btn-secondary btn-confirm-no"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
