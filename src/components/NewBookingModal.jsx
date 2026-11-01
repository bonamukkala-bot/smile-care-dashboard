import { useState, useEffect, useRef } from 'react'
import { X, AlertCircle, Loader2 } from 'lucide-react'
import {
  getTodayIST,
  isSundayIST,
  getInitialBookingDate,
  isSlotInPast,
  formatSlotStartISO,
  fetchTakenSlotsForDate,
  invokeManageAppointment,
} from '../lib/helpers'
import SlotPicker from './SlotPicker'

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

  const nameInputRef = useRef(null)
  const dialogRef = useRef(null)

  const todayIST = getTodayIST()
  const isSunday = isSundayIST(selectedDate)

  // Initial focus and body scroll lock
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus first input
    const timer = setTimeout(() => {
      nameInputRef.current?.focus()
    }, 50)

    // Keydown for Escape and Focus Trap
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusableElements.length === 0) return
        const first = focusableElements[0]
        const last = focusableElements[focusableElements.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(timer)
    }
  }, [isOpen, isSubmitting, onClose])

  // Fetch taken slots when selectedDate changes
  useEffect(() => {
    if (!isOpen || !selectedDate) return
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
  }, [isOpen, selectedDate])

  if (!isOpen) return null

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
      nameInputRef.current?.focus()
      return
    }

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

    try {
      const res = await invokeManageAppointment(payload)

      if (res.ok) {
        setIsSubmitting(false)
        onSuccess?.('Booking added to the calendar')
        onClose()
      } else {
        setIsSubmitting(false)
        setFormError(res.error || 'Could not create booking. Please try again.')
      }
    } catch (err) {
      setIsSubmitting(false)
      setFormError(err?.message || 'Could not create booking. Please try again.')
    }
  }

  return (
    <div
      className="modal-backdrop-modern"
      onClick={() => {
        if (!isSubmitting) onClose()
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="modal-sheet-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-booking-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-sheet-header">
          <div className="sheet-header-title-group">
            <h2 id="new-booking-title" className="modal-sheet-title">
              New Appointment Booking
            </h2>
            <p className="modal-sheet-subtitle">
              Schedules an appointment and syncs to Google Calendar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-sheet-close"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </header>

        {formError && (
          <div className="modal-alert-error" role="alert">
            <AlertCircle size={18} className="alert-error-icon" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-sheet-form" noValidate>
          <div className="modal-scroll-area">
            {/* Patient Name */}
            <div className="form-group-modern">
              <label htmlFor="new-patient-name" className="form-label-modern">
                Patient Name <span className="required-star">*</span>
              </label>
              <input
                ref={nameInputRef}
                id="new-patient-name"
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                disabled={isSubmitting}
                className="form-input-modern"
                placeholder="e.g. Ramesh Kumar"
                required
              />
            </div>

            {/* Patient Phone */}
            <div className="form-group-modern">
              <label htmlFor="new-patient-phone" className="form-label-modern">
                Phone Number <span className="optional-tag">(optional)</span>
              </label>
              <input
                id="new-patient-phone"
                type="tel"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                disabled={isSubmitting}
                className="form-input-modern"
                placeholder="e.g. +91 98765 43210"
              />
            </div>

            {/* Reason */}
            <div className="form-group-modern">
              <label htmlFor="new-patient-reason" className="form-label-modern">
                Reason for Visit <span className="optional-tag">(optional)</span>
              </label>
              <input
                id="new-patient-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
                className="form-input-modern"
                placeholder="e.g. Toothache, cleaning, consultation"
              />
            </div>

            {/* Date */}
            <div className="form-group-modern">
              <label htmlFor="new-booking-date" className="form-label-modern">
                Date <span className="required-star">*</span>
              </label>
              <input
                id="new-booking-date"
                type="date"
                min={todayIST}
                value={selectedDate}
                onChange={handleDateChange}
                disabled={isSubmitting}
                className="form-input-modern date-input-modern"
                required
              />
              {isSunday && (
                <p className="form-field-warning" role="alert">
                  ⚠️ Clinic is closed on Sundays (Mon-Sat only). Please choose another day.
                </p>
              )}
            </div>

            {/* Time Slot Picker */}
            {!isSunday && (
              <div className="form-group-modern">
                <label className="form-label-modern">
                  Time Slot (IST) <span className="required-star">*</span>
                </label>
                <SlotPicker
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  onSelectTime={setSelectedTime}
                  takenSlots={takenSlots}
                  loadingSlots={loadingSlots}
                  disabled={isSubmitting}
                />
              </div>
            )}
          </div>

          {/* Sticky Footer Actions */}
          <footer className="modal-sheet-footer">
            <button
              type="submit"
              disabled={
                isSubmitting ||
                isSunday ||
                loadingSlots ||
                !selectedTime ||
                takenSlots.has(selectedTime)
              }
              className="btn btn-primary btn-submit-sheet"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="spinner-inline" aria-hidden="true" />
                  <span>Saving booking...</span>
                </>
              ) : (
                'Create Booking'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary btn-cancel-sheet"
            >
              Cancel
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
