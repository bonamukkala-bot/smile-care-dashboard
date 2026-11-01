import { useState, useEffect } from 'react'
import {
  CLINIC_SLOTS,
  getTodayIST,
  isSundayIST,
  getInitialBookingDate,
  isSlotInPast,
  formatSlotStartISO,
  fetchTakenSlotsForDate,
  invokeManageAppointment,
} from '../lib/helpers'

export default function NewBookingModal({ isOpen, onClose, onSuccess, initialDate }) {
  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [reason, setReason] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => {
    return initialDate && !isSundayIST(initialDate) ? initialDate : getInitialBookingDate()
  })
  const [selectedTime, setSelectedTime] = useState('')

  const [takenSlots, setTakenSlots] = useState(new Set())
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  const todayIST = getTodayIST()
  const isSunday = isSundayIST(selectedDate)

  // Fetch taken slots when selectedDate changes
  useEffect(() => {
    let isMounted = true

    fetchTakenSlotsForDate(selectedDate).then((taken) => {
      if (isMounted) {
        setTakenSlots(taken)
        setLoadingSlots(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [selectedDate])

  if (!isOpen) return null

  // Available slots for selectedDate:
  // For today, hide times that already passed.
  const visibleSlots = CLINIC_SLOTS.filter((slot) => {
    if (selectedDate === todayIST) {
      return !isSlotInPast(selectedDate, slot.time)
    }
    return true
  })

  // Has at least one selectable slot
  const hasAvailableSlot = visibleSlots.some((s) => !takenSlots.has(s.time))

  const handleDateChange = (e) => {
    const val = e.target.value
    setSelectedDate(val)
    setSelectedTime('')
    setLoadingSlots(true)
    setFormError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    setFormError(null)

    const trimmedName = patientName.trim()
    if (!trimmedName) {
      setFormError("Please enter the patient's name.")
      return
    }

    // Phone validation (digits, +, spaces)
    const trimmedPhone = patientPhone.trim()
    if (trimmedPhone) {
      const validChars = /^[\d\s+()-]+$/
      if (!validChars.test(trimmedPhone)) {
        setFormError('Please enter a valid phone number (digits, +, spaces only).')
        return
      }
    }

    if (!selectedDate) {
      setFormError('Please choose an appointment date.')
      return
    }

    if (isSunday) {
      setFormError('Clinic is closed on Sundays (Mon-Sat only).')
      return
    }

    if (selectedDate < todayIST) {
      setFormError('Past dates are not allowed. Please choose today or a future date.')
      return
    }

    if (!selectedTime) {
      setFormError('Please select an appointment time slot.')
      return
    }

    if (takenSlots.has(selectedTime)) {
      setFormError('This slot is already booked. Please choose another time.')
      return
    }

    if (selectedDate === todayIST && isSlotInPast(selectedDate, selectedTime)) {
      setFormError('This time has already passed. Please choose a future time.')
      return
    }

    setIsSubmitting(true)

    const slotStartISO = formatSlotStartISO(selectedDate, selectedTime)
    const payload = {
      action: 'create',
      patient_name: trimmedName,
      patient_phone: trimmedPhone || undefined,
      reason: reason.trim() || undefined,
      slot_start: slotStartISO,
    }

    const res = await invokeManageAppointment(payload)

    if (res.ok) {
      setIsSubmitting(false)
      onSuccess('Booking added to the calendar')
      onClose()
    } else {
      setIsSubmitting(false)
      setFormError(res.error || 'Could not create booking. Please try again.')
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="new-booking-title">
      <div className="modal-content">
        <header className="modal-header">
          <h2 id="new-booking-title" className="modal-title">
            New Appointment Booking
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

        {formError && (
          <div className="alert alert-error" role="alert">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="booking-modal-form" noValidate>
          {/* Patient Name */}
          <div className="booking-form-group">
            <label htmlFor="patient-name-input" className="booking-form-label">
              Patient Name <span className="required-star">*</span>
            </label>
            <input
              id="patient-name-input"
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              disabled={isSubmitting}
              className="booking-form-input"
              placeholder="e.g. Ramesh Kumar"
              required
            />
          </div>

          {/* Patient Phone */}
          <div className="booking-form-group">
            <label htmlFor="patient-phone-input" className="booking-form-label">
              Phone Number <span className="optional-hint">(optional)</span>
            </label>
            <input
              id="patient-phone-input"
              type="tel"
              value={patientPhone}
              onChange={(e) => setPatientPhone(e.target.value)}
              disabled={isSubmitting}
              className="booking-form-input"
              placeholder="e.g. +91 98765 43210"
            />
          </div>

          {/* Reason */}
          <div className="booking-form-group">
            <label htmlFor="patient-reason-input" className="booking-form-label">
              Reason for Visit <span className="optional-hint">(optional)</span>
            </label>
            <input
              id="patient-reason-input"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              className="booking-form-input"
              placeholder="e.g. Root canal consultation, toothache"
            />
          </div>

          {/* Date Picker */}
          <div className="booking-form-group">
            <label htmlFor="booking-date-input" className="booking-form-label">
              Date <span className="required-star">*</span>
            </label>
            <input
              id="booking-date-input"
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

          {/* Time Dropdown */}
          {!isSunday && (
            <div className="booking-form-group">
              <label htmlFor="booking-time-select" className="booking-form-label">
                Time Slot (IST) <span className="required-star">*</span>
              </label>

              {loadingSlots ? (
                <div className="slot-loading-hint">Checking available slots...</div>
              ) : visibleSlots.length === 0 ? (
                <p className="form-field-warning">
                  No remaining slots available today. Please choose a future date.
                </p>
              ) : !hasAvailableSlot ? (
                <p className="form-field-warning">
                  All slots are booked for this day. Please choose another date.
                </p>
              ) : (
                <select
                  id="booking-time-select"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  disabled={isSubmitting}
                  className="booking-form-select"
                  required
                >
                  <option value="">-- Choose a time slot --</option>
                  {visibleSlots.map((slot) => {
                    const isTaken = takenSlots.has(slot.time)
                    return (
                      <option
                        key={slot.time}
                        value={slot.time}
                        disabled={isTaken}
                      >
                        {slot.label} {isTaken ? '(Taken)' : ''}
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
                takenSlots.has(selectedTime)
              }
              className="btn btn-primary btn-submit-booking"
            >
              {isSubmitting ? 'Saving booking...' : 'Create Booking'}
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
      </div>
    </div>
  )
}
