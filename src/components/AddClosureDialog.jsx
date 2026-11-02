import { useState, useEffect, useRef, useMemo } from 'react'
import {
  X,
  Clock,
  UserX,
  CalendarDays,
  AlertTriangle,
  Sun,
  MoreHorizontal,
  Loader2,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  getTodayIST,
  isSundayIST,
  getNextHalfHourIST,
  canCloseRestOfToday,
  formatTime24To12,
  addDaysToISTDate,
  formatClosureReason,
  formatISTDateLabel,
  formatSlotRange,
  invokeManageClosure,
} from '../lib/helpers'

const REASONS = [
  { id: 'doctor_leave', label: 'Doctor on leave', icon: UserX },
  { id: 'event', label: 'Doctor at an event', icon: CalendarDays },
  { id: 'emergency', label: 'Emergency', icon: AlertTriangle },
  { id: 'holiday', label: 'Holiday', icon: Sun },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
]

const TIME_OPTIONS = [
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
]

export default function AddClosureDialog({ isOpen, onClose, onSuccess }) {
  const todayIST = getTodayIST()
  const showQuickChip = useMemo(() => canCloseRestOfToday(), [])
  const nextHalfHour = useMemo(() => getNextHalfHourIST(), [])
  const nextHalfHour12 = useMemo(() => formatTime24To12(nextHalfHour), [nextHalfHour])

  // Form states
  const [reason, setReason] = useState('doctor_leave')
  const [durationMode, setDurationMode] = useState('full_days') // 'full_days' | 'specific_hours'

  // Full day(s) inputs
  const [dateFrom, setDateFrom] = useState(todayIST)
  const [dateTo, setDateTo] = useState(todayIST)

  // Specific hours inputs
  const [specificDate, setSpecificDate] = useState(todayIST)
  const [startTime, setStartTime] = useState(
    specificDate === todayIST && nextHalfHour < '20:30' ? nextHalfHour : '10:00'
  )
  const [endTime, setEndTime] = useState('20:30')

  // Note
  const [note, setNote] = useState('')

  // Dialog step & submission state
  const [step, setStep] = useState('form') // 'form' | 'review'
  const [dialogError, setDialogError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  // Review step lookup state
  const [checkingBookings, setCheckingBookings] = useState(false)
  const [previewBookings, setPreviewBookings] = useState([])

  const dialogRef = useRef(null)
  const firstFocusableRef = useRef(null)

  // Quick chip handler
  const handleQuickChipClick = () => {
    setDateFrom(todayIST)
    setDateTo(todayIST)
    setDurationMode('full_days')
    setReason('emergency')
    setDialogError(null)
  }

  // Calculate max dateTo (31 days after dateFrom)
  const maxDateTo = useMemo(() => {
    return addDaysToISTDate(dateFrom, 31)
  }, [dateFrom])

  // Filter "From" options for today in IST
  const availableFromTimes = useMemo(() => {
    if (specificDate === todayIST) {
      return TIME_OPTIONS.filter((t) => t >= nextHalfHour && t < '20:30')
    }
    return TIME_OPTIONS.filter((t) => t < '20:30')
  }, [specificDate, todayIST, nextHalfHour])

  const effectiveStartTime = useMemo(() => {
    if (availableFromTimes.length === 0) return '10:00'
    return availableFromTimes.includes(startTime) ? startTime : availableFromTimes[0]
  }, [availableFromTimes, startTime])

  // Filter "Until" options strictly greater than startTime
  const availableUntilTimes = useMemo(() => {
    return TIME_OPTIONS.filter((t) => t > effectiveStartTime)
  }, [effectiveStartTime])

  const effectiveEndTime = useMemo(() => {
    if (availableUntilTimes.length === 0) return '20:30'
    return availableUntilTimes.includes(endTime)
      ? endTime
      : availableUntilTimes[availableUntilTimes.length - 1]
  }, [availableUntilTimes, endTime])

  // Lock body scroll and trap focus / Escape key
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSaving) {
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
  }, [isOpen, isSaving, onClose])

  if (!isOpen) return null

  // Arrow key navigation for reason radio chips
  const handleReasonKeyDown = (e, index) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIdx = (index + 1) % REASONS.length
      setReason(REASONS[nextIdx].id)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIdx = (index - 1 + REASONS.length) % REASONS.length
      setReason(REASONS[prevIdx].id)
    }
  }

  // Handle Proceed to Review step
  const handleReview = async () => {
    setDialogError(null)

    // Validation
    if (durationMode === 'specific_hours') {
      if (isSundayIST(specificDate)) {
        setDialogError('The clinic is closed on Sundays')
        return
      }
      if (!effectiveStartTime || !effectiveEndTime || effectiveEndTime <= effectiveStartTime) {
        setDialogError('"Until" time must be after "From" time.')
        return
      }
    } else {
      if (dateTo < dateFrom) {
        setDialogError('"Last day" cannot be earlier than "First day".')
        return
      }
    }

    setStep('review')
    setCheckingBookings(true)

    // Run informational booking lookup
    try {
      let startISO = ''
      let endISO = ''

      if (durationMode === 'specific_hours') {
        startISO = `${specificDate}T${effectiveStartTime}:00+05:30`
        endISO = `${specificDate}T${effectiveEndTime}:00+05:30`
      } else {
        // Date range: from first day 10:00 AM (or next half hour if today) to last day 20:30
        const fromStart =
          dateFrom === todayIST && nextHalfHour > '10:00'
            ? nextHalfHour
            : '10:00'
        startISO = `${dateFrom}T${fromStart}:00+05:30`
        endISO = `${dateTo}T20:30:00+05:30`
      }

      const { data, error } = await supabase
        .from('appointments')
        .select('id, patient_name, patient_phone, slot_start, status')
        .eq('doctor_id', 1)
        .in('status', ['booked', 'confirmed'])
        .gte('slot_start', new Date(startISO).toISOString())
        .lt('slot_start', new Date(endISO).toISOString())
        .order('slot_start', { ascending: true })

      if (error) {
        console.error('Error in review booking lookup:', error.message)
        setPreviewBookings([])
      } else {
        setPreviewBookings(data || [])
      }
    } catch (err) {
      console.error('Lookup exception:', err)
      setPreviewBookings([])
    } finally {
      setCheckingBookings(false)
    }
  }

  // Handle final "Block this time" execution
  const handleExecuteCreate = async () => {
    if (isSaving) return
    setIsSaving(true)
    setDialogError(null)

    const payload = {
      action: 'create',
      reason,
      note: note.trim() || undefined,
    }

    if (durationMode === 'specific_hours') {
      payload.date_from = specificDate
      payload.date_to = specificDate
      payload.start_time = effectiveStartTime
      payload.end_time = effectiveEndTime
    } else {
      payload.date_from = dateFrom
      payload.date_to = dateTo
    }

    try {
      const res = await invokeManageClosure(payload)

      if (!res.ok) {
        setDialogError(res.error || 'Failed to add closure. Please try again.')
        setIsSaving(false)
        return
      }

      // Success
      onSuccess?.(res.data)
      onClose()
    } catch (err) {
      setDialogError(err?.message || 'Failed to add closure. Please try again.')
      setIsSaving(false)
    }
  }

  // Summary labels for Review step
  const reasonLabel = formatClosureReason(reason)

  const dateSummary =
    durationMode === 'specific_hours'
      ? formatISTDateLabel(specificDate)
      : dateFrom === dateTo
        ? formatISTDateLabel(dateFrom)
        : `${formatISTDateLabel(dateFrom)} to ${formatISTDateLabel(dateTo)}`

  const windowSummary =
    durationMode === 'specific_hours'
      ? `${formatTime24To12(effectiveStartTime)} to ${formatTime24To12(effectiveEndTime)}`
      : 'Full day(s)'

  return (
    <div
      className="modal-sheet-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        className="modal-sheet-panel add-closure-dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-closure-title"
      >
        {/* Header */}
        <header className="modal-sheet-header">
          <div className="sheet-header-title-wrap">
            {step === 'review' && (
              <button
                type="button"
                onClick={() => {
                  setStep('form')
                  setDialogError(null)
                }}
                disabled={isSaving}
                className="btn-dialog-back"
                aria-label="Back to edit closure details"
              >
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
            )}
            <h2 id="add-closure-title" className="modal-sheet-title">
              {step === 'review' ? 'Review & Confirm Closure' : 'Add closure'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="modal-sheet-close-btn"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </header>

        {/* Global Error Banner */}
        {dialogError && (
          <div className="modal-alert-error" role="alert">
            <AlertTriangle size={18} className="alert-error-icon" aria-hidden="true" />
            <span>{dialogError}</span>
          </div>
        )}

        {step === 'form' ? (
          /* STEP 1: INPUT FORM */
          <div className="modal-sheet-form">
            <div className="modal-scroll-area">
              {/* Quick Chip: Close rest of today */}
              {showQuickChip && (
                <div className="quick-chip-banner">
                  <button
                    type="button"
                    onClick={handleQuickChipClick}
                    className="btn-quick-chip"
                  >
                    <Clock size={16} aria-hidden="true" />
                    <span>Close the rest of today</span>
                  </button>
                  <p className="quick-chip-hint">
                    This blocks from {nextHalfHour12} until 8:30 PM today.
                  </p>
                </div>
              )}

              {/* Reason: Radio Group Chips */}
              <div className="form-group-modern">
                <label id="reason-group-label" className="form-label-modern">
                  Reason <span className="required-star">*</span>
                </label>
                <div
                  className="closure-reason-chips"
                  role="radiogroup"
                  aria-labelledby="reason-group-label"
                >
                  {REASONS.map((r, idx) => {
                    const isSelected = reason === r.id
                    const IconComp = r.icon
                    return (
                      <label
                        key={r.id}
                        className={`reason-chip-btn ${isSelected ? 'reason-chip-active' : ''}`}
                        onKeyDown={(e) => handleReasonKeyDown(e, idx)}
                      >
                        <input
                          ref={idx === 0 ? firstFocusableRef : undefined}
                          type="radio"
                          name="closure-reason"
                          value={r.id}
                          checked={isSelected}
                          onChange={() => setReason(r.id)}
                          className="visually-hidden"
                        />
                        <IconComp size={16} aria-hidden="true" />
                        <span>{r.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Duration: Segmented Control */}
              <div className="form-group-modern">
                <label className="form-label-modern">Duration</label>
                <div className="segmented-control" role="tablist" aria-label="Duration mode">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={durationMode === 'full_days'}
                    onClick={() => {
                      setDurationMode('full_days')
                      setDialogError(null)
                    }}
                    className={`segmented-btn ${durationMode === 'full_days' ? 'active' : ''}`}
                  >
                    Full day(s)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={durationMode === 'specific_hours'}
                    onClick={() => {
                      setDurationMode('specific_hours')
                      setDialogError(null)
                    }}
                    className={`segmented-btn ${durationMode === 'specific_hours' ? 'active' : ''}`}
                  >
                    Specific hours
                  </button>
                </div>
              </div>

              {/* Duration Mode: Full day(s) */}
              {durationMode === 'full_days' && (
                <div className="full-days-date-grid">
                  <div className="form-group-modern">
                    <label htmlFor="closure-date-from" className="form-label-modern">
                      First day <span className="required-star">*</span>
                    </label>
                    <input
                      id="closure-date-from"
                      type="date"
                      min={todayIST}
                      value={dateFrom}
                      onChange={(e) => {
                        const val = e.target.value
                        setDateFrom(val)
                        if (dateTo < val) setDateTo(val)
                        const maxTo = addDaysToISTDate(val, 31)
                        if (dateTo > maxTo) setDateTo(maxTo)
                      }}
                      className="form-input-modern date-input-modern"
                      required
                    />
                  </div>

                  <div className="form-group-modern">
                    <label htmlFor="closure-date-to" className="form-label-modern">
                      Last day <span className="required-star">*</span>
                    </label>
                    <input
                      id="closure-date-to"
                      type="date"
                      min={dateFrom}
                      max={maxDateTo}
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="form-input-modern date-input-modern"
                      required
                    />
                  </div>

                  <p className="form-field-helper">
                    Sundays are skipped because the clinic is already closed.
                  </p>
                </div>
              )}

              {/* Duration Mode: Specific hours */}
              {durationMode === 'specific_hours' && (
                <div className="specific-hours-block">
                  <div className="form-group-modern">
                    <label htmlFor="closure-specific-date" className="form-label-modern">
                      Date <span className="required-star">*</span>
                    </label>
                    <input
                      id="closure-specific-date"
                      type="date"
                      min={todayIST}
                      value={specificDate}
                      onChange={(e) => {
                        const val = e.target.value
                        setSpecificDate(val)
                        setDialogError(null)
                      }}
                      className="form-input-modern date-input-modern"
                      required
                    />
                    {isSundayIST(specificDate) && (
                      <p className="form-field-warning" role="alert">
                        ⚠️ The clinic is closed on Sundays
                      </p>
                    )}
                  </div>

                  <div className="specific-hours-row">
                    <div className="form-group-modern">
                      <label htmlFor="closure-time-from" className="form-label-modern">
                        From <span className="required-star">*</span>
                      </label>
                      <select
                        id="closure-time-from"
                        value={effectiveStartTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="form-input-modern form-select-modern"
                      >
                        {availableFromTimes.map((t) => (
                          <option key={t} value={t}>
                            {formatTime24To12(t)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group-modern">
                      <label htmlFor="closure-time-until" className="form-label-modern">
                        Until <span className="required-star">*</span>
                      </label>
                      <select
                        id="closure-time-until"
                        value={effectiveEndTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="form-input-modern form-select-modern"
                      >
                        {availableUntilTimes.map((t) => (
                          <option key={t} value={t}>
                            {formatTime24To12(t)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Note (optional) with 200 char counter */}
              <div className="form-group-modern">
                <div className="note-label-row">
                  <label htmlFor="closure-note" className="form-label-modern">
                    Note <span className="optional-tag">(optional)</span>
                  </label>
                  <span
                    className={`note-char-counter ${note.length >= 190 ? 'char-counter-warn' : ''}`}
                    aria-live="polite"
                  >
                    {note.length}/200
                  </span>
                </div>
                <textarea
                  id="closure-note"
                  rows={2}
                  maxLength={200}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="For example: Doctor at a dental conference"
                  className="form-input-modern form-textarea-modern"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <footer className="modal-sheet-footer">
              <button
                type="button"
                onClick={handleReview}
                disabled={
                  durationMode === 'specific_hours' && isSundayIST(specificDate)
                }
                className="btn btn-primary btn-submit-sheet"
              >
                Review →
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary btn-cancel-sheet"
              >
                Cancel
              </button>
            </footer>
          </div>
        ) : (
          /* STEP 2: REVIEW & CONFIRM STEP */
          <div className="modal-sheet-form">
            <div className="modal-scroll-area review-scroll-area">
              <div className="closure-review-summary-card">
                <span className="review-badge-label">CLOSURE SUMMARY</span>
                <p className="review-summary-main">
                  You are about to block: <strong>{dateSummary}</strong> ({windowSummary}).
                </p>
                <p className="review-summary-sub">
                  Reason: <strong>{reasonLabel}</strong>
                  {note.trim() && ` • Note: "${note.trim()}"`}
                </p>
              </div>

              {/* Booking Impact Notice */}
              {checkingBookings ? (
                <div className="review-lookup-loading">
                  <Loader2 size={18} className="spinner-inline" aria-hidden="true" />
                  <span>Checking existing bookings for this window...</span>
                </div>
              ) : previewBookings.length > 0 ? (
                <div className="review-bookings-impact-box box-amber" role="alert">
                  <div className="impact-header">
                    <AlertTriangle size={18} className="impact-icon-amber" aria-hidden="true" />
                    <strong>
                      {previewBookings.length} existing {previewBookings.length === 1 ? 'booking falls' : 'bookings fall'} in this time.
                    </strong>
                  </div>
                  <p className="impact-desc">
                    They will NOT be cancelled automatically. You will see the list next so you can move or cancel them and call the patients.
                  </p>
                  <ul className="preview-bookings-list">
                    {previewBookings.slice(0, 5).map((b) => (
                      <li key={b.id} className="preview-booking-item">
                        <span className="preview-patient">{b.patient_name || 'Patient'}</span>
                        <span className="preview-time">{formatSlotRange(b.slot_start)}</span>
                      </li>
                    ))}
                  </ul>
                  {previewBookings.length > 5 && (
                    <span className="preview-more-count">
                      ...and {previewBookings.length - 5} more
                    </span>
                  )}
                </div>
              ) : (
                <div className="review-bookings-impact-box box-green" role="status">
                  <CheckCircle2 size={18} className="impact-icon-green" aria-hidden="true" />
                  <span>No existing bookings fall in this time.</span>
                </div>
              )}
            </div>

            {/* Footer Buttons for Review */}
            <footer className="modal-sheet-footer">
              <button
                type="button"
                onClick={handleExecuteCreate}
                disabled={isSaving || checkingBookings}
                className="btn btn-primary btn-submit-sheet"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={18} className="spinner-inline" aria-hidden="true" />
                    <span>Blocking the calendar...</span>
                  </>
                ) : (
                  'Block this time'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('form')
                  setDialogError(null)
                }}
                disabled={isSaving}
                className="btn btn-secondary btn-cancel-sheet"
              >
                Back
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  )
}
