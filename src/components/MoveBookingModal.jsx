import { useState, useEffect, useRef, useMemo } from 'react'
import { X, AlertCircle, ArrowLeft, Loader2, Calendar, User, Clock } from 'lucide-react'
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
import SlotPicker from './SlotPicker'

export default function MoveBookingModal({ isOpen, onClose, onSuccess, appointment }) {
  const [selectedDate, setSelectedDate] = useState(() => getInitialBookingDate())
  const [selectedTime, setSelectedTime] = useState('')
  const [step, setStep] = useState('select') // 'select' | 'confirm'

  const [takenSlots, setTakenSlots] = useState(new Set())
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState(null)

  const dialogRef = useRef(null)

  const todayIST = getTodayIST()
  const isSunday = isSundayIST(selectedDate)

  // Current appointment details
  const currentSlotStart = appointment?.slot_start
  const currentDateKey = getISTDateKey(currentSlotStart)
  const currentSlotTime = getISTSlotTime(currentSlotStart)
  const currentSlotObj = CLINIC_SLOTS.find((s) => s.time === currentSlotTime)
  const currentSlotLabel = currentSlotObj ? currentSlotObj.label : currentSlotTime

  const isCurrentDate = selectedDate === currentDateKey

  // Lock body scroll and handle Escape/Tab focus trap
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

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
    }
  }, [isOpen, isSubmitting, onClose])

  // Fetch taken slots when date changes (excluding this appointment itself)
  useEffect(() => {
    if (!isOpen || !selectedDate) return
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
  }, [isOpen, selectedDate, appointment?.id])

  const selectedSlotObj = useMemo(
    () => CLINIC_SLOTS.find((s) => s.time === selectedTime),
    [selectedTime]
  )
  const targetLabel = selectedSlotObj ? selectedSlotObj.label : selectedTime
  const targetDateLabel = formatISTDateLabel(selectedDate)

  if (!isOpen || !appointment) return null

  const isCurrentSlot = (slotTime) => {
    return isCurrentDate && slotTime === currentSlotTime
  }

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

    try {
      const res = await invokeManageAppointment(payload)

      if (res.ok) {
        setIsSubmitting(false)
        onSuccess?.(`Booking moved to ${targetDateLabel}, ${targetLabel}`)
        onClose()
      } else {
        setIsSubmitting(false)
        setStep('select')
        setModalError(res.error || 'Could not move booking. Please try again.')
      }
    } catch (err) {
      setIsSubmitting(false)
      setStep('select')
      setModalError(err?.message || 'Could not move booking. Please try again.')
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
        aria-labelledby="move-booking-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-sheet-header">
          <div className="sheet-header-title-group">
            <h2 id="move-booking-title" className="modal-sheet-title">
              Move Appointment
            </h2>
            <p className="modal-sheet-subtitle">
              Reschedules the appointment and updates Google Calendar.
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

        {modalError && (
          <div className="modal-alert-error" role="alert">
            <AlertCircle size={18} className="alert-error-icon" aria-hidden="true" />
            <span>{modalError}</span>
          </div>
        )}

        {/* Current Booking Info Card */}
        <div className="current-booking-card" aria-label="Current appointment info">
          <div className="current-booking-row">
            <div className="current-patient-info">
              <User size={16} className="current-icon" aria-hidden="true" />
              <span className="current-label">Patient:</span>
              <strong className="current-val">{appointment.patient_name || 'Patient'}</strong>
            </div>
          </div>
          <div className="current-booking-row">
            <div className="current-time-info">
              <Clock size={16} className="current-icon" aria-hidden="true" />
              <span className="current-label">Current slot:</span>
              <span className="current-val">
                {formatISTDateLabel(currentDateKey)} at {currentSlotLabel}
              </span>
            </div>
          </div>
        </div>

        {step === 'select' ? (
          <form onSubmit={handleProceedToConfirm} className="modal-sheet-form">
            <div className="modal-scroll-area">
              {/* New Date Picker */}
              <div className="form-group-modern">
                <label htmlFor="move-booking-date" className="form-label-modern">
                  New Date <span className="required-star">*</span>
                </label>
                <div className="date-input-wrap">
                  <input
                    id="move-booking-date"
                    type="date"
                    min={todayIST}
                    value={selectedDate}
                    onChange={handleDateChange}
                    disabled={isSubmitting}
                    className="form-input-modern date-input-modern"
                    required
                  />
                </div>
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
                    New Time Slot (IST) <span className="required-star">*</span>
                  </label>
                  <SlotPicker
                    selectedDate={selectedDate}
                    selectedTime={selectedTime}
                    onSelectTime={setSelectedTime}
                    takenSlots={takenSlots}
                    currentSlotTime={currentSlotTime}
                    isCurrentDate={isCurrentDate}
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
                  isCurrentSlot(selectedTime) ||
                  takenSlots.has(selectedTime)
                }
                className="btn btn-primary btn-submit-sheet"
              >
                Proceed to Confirm →
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
        ) : (
          /* Step 2: Confirmation Screen */
          <div className="reschedule-confirm-container" role="alert">
            <div className="confirm-icon-badge">
              <Calendar size={28} className="confirm-cal-icon" aria-hidden="true" />
            </div>

            <h3 className="confirm-step-title">Confirm Appointment Move</h3>

            <p className="confirm-step-prompt">
              Move booking for <strong>{appointment.patient_name || 'Patient'}</strong> to:
            </p>

            <div className="confirm-slot-highlight">
              <span className="confirm-date-text">{targetDateLabel}</span>
              <span className="confirm-time-text">at {targetLabel}</span>
            </div>

            <p className="confirm-sync-notice">
              This will automatically update the appointment on Google Calendar.
            </p>

            <div className="modal-sheet-footer confirm-footer">
              <button
                type="button"
                onClick={handleExecuteReschedule}
                disabled={isSubmitting}
                className="btn btn-primary btn-submit-sheet"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="spinner-inline" aria-hidden="true" />
                    <span>Moving booking...</span>
                  </>
                ) : (
                  'Yes, move booking'
                )}
              </button>
              <button
                type="button"
                onClick={() => setStep('select')}
                disabled={isSubmitting}
                className="btn btn-secondary btn-cancel-sheet"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span>Back</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
