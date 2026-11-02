import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
  Calendar,
  Layers,
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

/**
 * Format date in full words like "Friday, 6 November 2026"
 */
function formatLongDateIST(dateStr) {
  if (!dateStr) return '-'
  try {
    const d = new Date(`${dateStr}T12:00:00+05:30`)
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
  } catch {
    return dateStr
  }
}

export default function AddClosureDialog({
  isOpen,
  onClose,
  onSuccess,
  initialDate = null,
  initialType = null,
}) {
  const todayIST = useMemo(() => getTodayIST(), [])
  const showRestOfToday = useMemo(() => canCloseRestOfToday(), [])
  const nextHalfHour = useMemo(() => getNextHalfHourIST(), [])
  const nextHalfHour12 = useMemo(() => formatTime24To12(nextHalfHour), [nextHalfHour])

  // Determine starting step and type based on props
  const [step, setStep] = useState(() => {
    if (initialType === 'rest_of_today' || initialDate) return 2
    return 1
  })

  // Closure type: 'rest_of_today' | 'whole_day' | 'several_days' | 'few_hours'
  const [closureType, setClosureType] = useState(() => {
    if (initialType === 'rest_of_today') return 'rest_of_today'
    if (initialDate) return 'whole_day'
    return 'whole_day'
  })

  // Reason: default to 'emergency' for rest_of_today, 'doctor_leave' for others
  const [reason, setReason] = useState(() => {
    return initialType === 'rest_of_today' ? 'emergency' : 'doctor_leave'
  })

  // Date states
  const [wholeDate, setWholeDate] = useState(() => initialDate || todayIST)
  const [dateFrom, setDateFrom] = useState(() => initialDate || todayIST)
  const [dateTo, setDateTo] = useState(() => initialDate || todayIST)
  const [fewHoursDate, setFewHoursDate] = useState(() => initialDate || todayIST)

  // Session preset for "A few hours": 'morning' | 'evening' | 'custom'
  const [sessionPreset, setSessionPreset] = useState('morning')
  const [customStartTime, setCustomStartTime] = useState('10:00')
  const [customEndTime, setCustomEndTime] = useState('13:30')

  // Note
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [note, setNote] = useState('')

  // Submission & review states
  const [dialogError, setDialogError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [checkingBookings, setCheckingBookings] = useState(false)
  const [previewBookings, setPreviewBookings] = useState([])

  const dialogRef = useRef(null)

  // Calculate max dateTo (31 days after dateFrom)
  const maxDateTo = useMemo(() => {
    return addDaysToISTDate(dateFrom, 31)
  }, [dateFrom])

  // Count non-Sundays for several days
  const nonSundayCount = useMemo(() => {
    if (!dateFrom || !dateTo || dateTo < dateFrom) return 0
    let count = 0
    let cur = dateFrom
    while (cur <= dateTo) {
      if (!isSundayIST(cur)) count++
      cur = addDaysToISTDate(cur, 1)
    }
    return count
  }, [dateFrom, dateTo])

  // Effective times for "A few hours"
  const availableFromTimes = useMemo(() => {
    if (fewHoursDate === todayIST) {
      return TIME_OPTIONS.filter((t) => t >= nextHalfHour && t < '20:30')
    }
    return TIME_OPTIONS.filter((t) => t < '20:30')
  }, [fewHoursDate, todayIST, nextHalfHour])

  const effectiveStartTime = useMemo(() => {
    if (sessionPreset === 'morning') return '10:00'
    if (sessionPreset === 'evening') return '17:00'
    if (availableFromTimes.length === 0) return '10:00'
    return availableFromTimes.includes(customStartTime)
      ? customStartTime
      : availableFromTimes[0]
  }, [sessionPreset, availableFromTimes, customStartTime])

  const availableUntilTimes = useMemo(() => {
    return TIME_OPTIONS.filter((t) => t > effectiveStartTime)
  }, [effectiveStartTime])

  const effectiveEndTime = useMemo(() => {
    if (sessionPreset === 'morning') return '13:30'
    if (sessionPreset === 'evening') return '20:30'
    if (availableUntilTimes.length === 0) return '20:30'
    return availableUntilTimes.includes(customEndTime)
      ? customEndTime
      : availableUntilTimes[availableUntilTimes.length - 1]
  }, [sessionPreset, availableUntilTimes, customEndTime])

  // Presets disabled state if time has passed today
  const isMorningPassedToday = useMemo(() => {
    return fewHoursDate === todayIST && nextHalfHour > '13:00'
  }, [fewHoursDate, todayIST, nextHalfHour])

  const isEveningPassedToday = useMemo(() => {
    return fewHoursDate === todayIST && nextHalfHour > '20:00'
  }, [fewHoursDate, todayIST, nextHalfHour])

  // Body scroll lock and focus trap / Escape key
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

  // Step 2 validation check
  const step2Validation = () => {
    if (closureType === 'rest_of_today') {
      return { valid: true, error: null }
    }
    if (closureType === 'whole_day') {
      if (!wholeDate) {
        return { valid: false, error: 'Please choose a date.' }
      }
      if (isSundayIST(wholeDate)) {
        return {
          valid: false,
          error: 'The clinic is already closed on Sundays. Please pick another day.',
        }
      }
      return { valid: true, error: null }
    }
    if (closureType === 'several_days') {
      if (!dateFrom || !dateTo) {
        return { valid: false, error: 'Please select both start and end dates.' }
      }
      if (dateTo < dateFrom) {
        return { valid: false, error: '"To" date cannot be earlier than "From" date.' }
      }
      if (nonSundayCount === 0) {
        return { valid: false, error: 'There is nothing to close on those dates.' }
      }
      return { valid: true, error: null }
    }
    if (closureType === 'few_hours') {
      if (!fewHoursDate) {
        return { valid: false, error: 'Please choose a date.' }
      }
      if (isSundayIST(fewHoursDate)) {
        return { valid: false, error: 'The clinic is closed on Sundays.' }
      }
      if (sessionPreset === 'morning' && isMorningPassedToday) {
        return {
          valid: false,
          error: 'Morning hours have already passed for today. Pick evening or custom times.',
        }
      }
      if (sessionPreset === 'evening' && isEveningPassedToday) {
        return { valid: false, error: 'Evening hours have already passed for today.' }
      }
      if (!effectiveStartTime || !effectiveEndTime || effectiveEndTime <= effectiveStartTime) {
        return { valid: false, error: '"Until" time must be after "From" time.' }
      }
      return { valid: true, error: null }
    }
    return { valid: true, error: null }
  }

  const { valid: isStep2Valid, error: step2Error } = step2Validation()

  // Transition from Step 1 to Step 2
  const handleSelectTile = (type) => {
    setClosureType(type)
    if (type === 'rest_of_today') {
      setReason('emergency')
    }
    setDialogError(null)
    setStep(2)
  }

  // Arrow key navigation for Step 1 tiles
  const handleTileKeyDown = (e, type) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSelectTile(type)
    }
  }

  // Arrow key navigation for Reason chips
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

  // Advance to Step 3: Run booking impact lookup
  const handleGoToReview = async () => {
    const val = step2Validation()
    if (!val.valid) {
      setDialogError(val.error)
      return
    }

    setDialogError(null)
    setStep(3)
    setCheckingBookings(true)

    try {
      let startISO = ''
      let endISO = ''

      if (closureType === 'rest_of_today') {
        const fromStart = nextHalfHour > '10:00' ? nextHalfHour : '10:00'
        startISO = `${todayIST}T${fromStart}:00+05:30`
        endISO = `${todayIST}T20:30:00+05:30`
      } else if (closureType === 'whole_day') {
        const fromStart =
          wholeDate === todayIST && nextHalfHour > '10:00' ? nextHalfHour : '10:00'
        startISO = `${wholeDate}T${fromStart}:00+05:30`
        endISO = `${wholeDate}T20:30:00+05:30`
      } else if (closureType === 'several_days') {
        const fromStart =
          dateFrom === todayIST && nextHalfHour > '10:00' ? nextHalfHour : '10:00'
        startISO = `${dateFrom}T${fromStart}:00+05:30`
        endISO = `${dateTo}T20:30:00+05:30`
      } else if (closureType === 'few_hours') {
        startISO = `${fewHoursDate}T${effectiveStartTime}:00+05:30`
        endISO = `${fewHoursDate}T${effectiveEndTime}:00+05:30`
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
        console.error('Impact lookup error:', error.message)
        setPreviewBookings([])
      } else {
        setPreviewBookings(data || [])
      }
    } catch (err) {
      console.error('Impact lookup exception:', err)
      setPreviewBookings([])
    } finally {
      setCheckingBookings(false)
    }
  }

  // Execute Create Closure: strictly send start_time and end_time ONLY for "A few hours"
  const handleExecuteCreate = async () => {
    if (isSaving) return
    setIsSaving(true)
    setDialogError(null)

    const payload = {
      action: 'create',
      reason,
      note: note.trim() || undefined,
    }

    if (closureType === 'rest_of_today') {
      payload.date_from = todayIST
      payload.date_to = todayIST
      // ABSOLUTELY NO start_time or end_time (Edge function clamps to next half hour)
    } else if (closureType === 'whole_day') {
      payload.date_from = wholeDate
      payload.date_to = wholeDate
      // ABSOLUTELY NO start_time or end_time
    } else if (closureType === 'several_days') {
      payload.date_from = dateFrom
      payload.date_to = dateTo
      // ABSOLUTELY NO start_time or end_time
    } else if (closureType === 'few_hours') {
      payload.date_from = fewHoursDate
      payload.date_to = fewHoursDate
      payload.start_time = effectiveStartTime
      payload.end_time = effectiveEndTime
    }

    try {
      const res = await invokeManageClosure(payload)

      if (!res.ok) {
        setDialogError(res.error || 'Failed to add closure. Please try again.')
        setIsSaving(false)
        return
      }

      onSuccess?.(res.data)
      onClose()
    } catch (err) {
      setDialogError(err?.message || 'Failed to add closure. Please try again.')
      setIsSaving(false)
    }
  }

  // Summary labels for Step 3
  const reasonLabel = formatClosureReason(reason)

  let summaryWhat = ''
  if (closureType === 'rest_of_today') {
    summaryWhat = `Today, from ${nextHalfHour12} until 8:30 PM`
  } else if (closureType === 'whole_day') {
    summaryWhat = `${formatLongDateIST(wholeDate)}, whole day (10:00 AM to 8:30 PM)`
  } else if (closureType === 'several_days') {
    summaryWhat = `${nonSundayCount} days: ${formatISTDateLabel(dateFrom)} to ${formatISTDateLabel(
      dateTo
    )} (Sundays skipped)`
  } else if (closureType === 'few_hours') {
    summaryWhat = `${formatLongDateIST(fewHoursDate)}, ${formatTime24To12(
      effectiveStartTime
    )} to ${formatTime24To12(effectiveEndTime)}`
  }

  const tomorrowIST = addDaysToISTDate(todayIST, 1)

  return createPortal(
    <div
      className="modal-portal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        className="add-closure-dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="closure-dialog-heading"
      >
        {/* Step Progress Bar */}
        <div
          className="closure-step-progressbar"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={3}
          aria-label={`Step ${step} of 3`}
        >
          <div
            className="closure-step-progress-fill"
            style={{ width: step === 1 ? '33.3%' : step === 2 ? '66.6%' : '100%' }}
          />
        </div>

        {/* Dialog Header */}
        <header className="modal-sheet-header">
          <div className="sheet-header-title-group">
            <div className="closure-dialog-header-top">
              <span className="closure-step-counter">Step {step} of 3</span>
            </div>
            <h2 id="closure-dialog-heading" className="modal-sheet-title">
              {step === 1 && 'What do you want to close?'}
              {step === 2 && 'Closure details'}
              {step === 3 && 'Check and confirm'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="btn-sheet-close"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </header>

        {/* Inline Error Alert */}
        {dialogError && (
          <div className="modal-alert-error" role="alert">
            <AlertTriangle size={18} className="alert-error-icon" aria-hidden="true" />
            <span>{dialogError}</span>
          </div>
        )}

        {/* ==================================================================
            STEP 1: What do you want to close? (Big Selectable Tiles)
            ================================================================== */}
        {step === 1 && (
          <div className="modal-sheet-form">
            <div className="modal-scroll-area">
              <p className="closure-step-intro">
                Choose what part of the calendar you need to block:
              </p>

              <div
                className="closure-type-tiles-grid"
                role="radiogroup"
                aria-label="Closure duration options"
              >
                {/* Tile 1: Rest of today */}
                {showRestOfToday && (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={closureType === 'rest_of_today'}
                    tabIndex={0}
                    onClick={() => handleSelectTile('rest_of_today')}
                    onKeyDown={(e) => handleTileKeyDown(e, 'rest_of_today')}
                    className={`closure-type-tile ${
                      closureType === 'rest_of_today' ? 'tile-selected' : ''
                    }`}
                  >
                    <div className="tile-icon-box box-accent">
                      <Clock size={22} aria-hidden="true" />
                    </div>
                    <div className="tile-text-wrap">
                      <strong className="tile-title">Rest of today</strong>
                      <span className="tile-sub">
                        From {nextHalfHour12} until 8:30 PM. For emergencies.
                      </span>
                    </div>
                  </button>
                )}

                {/* Tile 2: A whole day */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={closureType === 'whole_day'}
                  tabIndex={0}
                  onClick={() => handleSelectTile('whole_day')}
                  onKeyDown={(e) => handleTileKeyDown(e, 'whole_day')}
                  className={`closure-type-tile ${
                    closureType === 'whole_day' ? 'tile-selected' : ''
                  }`}
                >
                  <div className="tile-icon-box">
                    <Calendar size={22} aria-hidden="true" />
                  </div>
                  <div className="tile-text-wrap">
                    <strong className="tile-title">A whole day</strong>
                    <span className="tile-sub">Pick a specific date</span>
                  </div>
                </button>

                {/* Tile 3: Several days */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={closureType === 'several_days'}
                  tabIndex={0}
                  onClick={() => handleSelectTile('several_days')}
                  onKeyDown={(e) => handleTileKeyDown(e, 'several_days')}
                  className={`closure-type-tile ${
                    closureType === 'several_days' ? 'tile-selected' : ''
                  }`}
                >
                  <div className="tile-icon-box">
                    <Layers size={22} aria-hidden="true" />
                  </div>
                  <div className="tile-text-wrap">
                    <strong className="tile-title">Several days</strong>
                    <span className="tile-sub">For leave, holidays or trips</span>
                  </div>
                </button>

                {/* Tile 4: A few hours */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={closureType === 'few_hours'}
                  tabIndex={0}
                  onClick={() => handleSelectTile('few_hours')}
                  onKeyDown={(e) => handleTileKeyDown(e, 'few_hours')}
                  className={`closure-type-tile ${
                    closureType === 'few_hours' ? 'tile-selected' : ''
                  }`}
                >
                  <div className="tile-icon-box">
                    <Clock size={22} aria-hidden="true" />
                  </div>
                  <div className="tile-text-wrap">
                    <strong className="tile-title">A few hours</strong>
                    <span className="tile-sub">For example the morning or the evening</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Sticky Footer */}
            <footer className="modal-sheet-footer">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn btn-primary btn-submit-sheet"
              >
                Next →
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
        )}

        {/* ==================================================================
            STEP 2: Details (Dates, Times, Reason, Note)
            ================================================================== */}
        {step === 2 && (
          <div className="modal-sheet-form">
            <div className="modal-scroll-area">
              {/* Context Notice for Rest of Today */}
              {closureType === 'rest_of_today' && (
                <div className="closure-detail-banner banner-accent">
                  <Clock size={20} className="banner-icon" aria-hidden="true" />
                  <div className="banner-text">
                    <strong>Closing the rest of today</strong>
                    <p>
                      The clinic will be blocked from <strong>{nextHalfHour12}</strong> until{' '}
                      <strong>8:30 PM</strong> today.
                    </p>
                  </div>
                </div>
              )}

              {/* A Whole Day: Date chips + native date input */}
              {closureType === 'whole_day' && (
                <div className="form-group-modern">
                  <label htmlFor="closure-whole-date" className="form-label-modern">
                    Pick date <span className="required-star">*</span>
                  </label>

                  <div className="date-chip-presets">
                    {showRestOfToday && (
                      <button
                        type="button"
                        onClick={() => {
                          setWholeDate(todayIST)
                          setDialogError(null)
                        }}
                        className={`chip-preset-btn ${
                          wholeDate === todayIST ? 'chip-active' : ''
                        }`}
                      >
                        Today
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setWholeDate(tomorrowIST)
                        setDialogError(null)
                      }}
                      className={`chip-preset-btn ${
                        wholeDate === tomorrowIST ? 'chip-active' : ''
                      }`}
                    >
                      Tomorrow
                    </button>
                  </div>

                  <input
                    id="closure-whole-date"
                    type="date"
                    min={todayIST}
                    value={wholeDate}
                    onChange={(e) => {
                      setWholeDate(e.target.value)
                      setDialogError(null)
                    }}
                    className="form-input-modern date-input-modern"
                    required
                  />

                  {/* Friendly words date display */}
                  <div className="closure-friendly-date-line">
                    <span>{formatLongDateIST(wholeDate)}</span>
                  </div>

                  {isSundayIST(wholeDate) && (
                    <p className="form-field-warning" role="alert">
                      ⚠️ The clinic is already closed on Sundays. Please pick another day.
                    </p>
                  )}
                  {wholeDate === todayIST && !isSundayIST(wholeDate) && (
                    <p className="form-field-helper">
                      Only the remaining time today will be blocked.
                    </p>
                  )}
                </div>
              )}

              {/* Several Days: From & To inputs + non-Sunday counter */}
              {closureType === 'several_days' && (
                <div className="full-days-date-grid">
                  <div className="several-days-inputs-row">
                    <div className="form-group-modern">
                      <label htmlFor="closure-date-from" className="form-label-modern">
                        From date <span className="required-star">*</span>
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
                          setDialogError(null)
                        }}
                        className="form-input-modern date-input-modern"
                        required
                      />
                    </div>

                    <div className="form-group-modern">
                      <label htmlFor="closure-date-to" className="form-label-modern">
                        To date <span className="required-star">*</span>
                      </label>
                      <input
                        id="closure-date-to"
                        type="date"
                        min={dateFrom}
                        max={maxDateTo}
                        value={dateTo}
                        onChange={(e) => {
                          setDateTo(e.target.value)
                          setDialogError(null)
                        }}
                        className="form-input-modern date-input-modern"
                        required
                      />
                    </div>
                  </div>

                  {/* Live summary */}
                  <div className="several-days-live-summary">
                    {nonSundayCount > 0 ? (
                      <p className="several-days-count-line">
                        <strong>{nonSundayCount} days:</strong> {formatISTDateLabel(dateFrom)}{' '}
                        to {formatISTDateLabel(dateTo)}. Sundays are skipped.
                      </p>
                    ) : (
                      <p className="form-field-warning" role="alert">
                        ⚠️ There is nothing to close on those dates.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* A Few Hours: Date + Session Presets + Custom Times */}
              {closureType === 'few_hours' && (
                <div className="few-hours-config-block">
                  <div className="form-group-modern">
                    <label htmlFor="closure-hours-date" className="form-label-modern">
                      Date <span className="required-star">*</span>
                    </label>

                    <div className="date-chip-presets">
                      {showRestOfToday && (
                        <button
                          type="button"
                          onClick={() => {
                            setFewHoursDate(todayIST)
                            setDialogError(null)
                          }}
                          className={`chip-preset-btn ${
                            fewHoursDate === todayIST ? 'chip-active' : ''
                          }`}
                        >
                          Today
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setFewHoursDate(tomorrowIST)
                          setDialogError(null)
                        }}
                        className={`chip-preset-btn ${
                          fewHoursDate === tomorrowIST ? 'chip-active' : ''
                        }`}
                      >
                        Tomorrow
                      </button>
                    </div>

                    <input
                      id="closure-hours-date"
                      type="date"
                      min={todayIST}
                      value={fewHoursDate}
                      onChange={(e) => {
                        setFewHoursDate(e.target.value)
                        setDialogError(null)
                      }}
                      className="form-input-modern date-input-modern"
                      required
                    />

                    {isSundayIST(fewHoursDate) && (
                      <p className="form-field-warning" role="alert">
                        ⚠️ The clinic is closed on Sundays.
                      </p>
                    )}
                  </div>

                  {/* Session Presets */}
                  <div className="form-group-modern">
                    <label className="form-label-modern">Session preset</label>
                    <div className="session-preset-chips" role="radiogroup">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={sessionPreset === 'morning'}
                        disabled={isMorningPassedToday}
                        onClick={() => {
                          setSessionPreset('morning')
                          setDialogError(null)
                        }}
                        className={`session-preset-btn ${
                          sessionPreset === 'morning' ? 'preset-active' : ''
                        }`}
                      >
                        <Clock size={15} aria-hidden="true" />
                        <span>Morning (10:00 AM to 1:30 PM)</span>
                      </button>

                      <button
                        type="button"
                        role="radio"
                        aria-checked={sessionPreset === 'evening'}
                        disabled={isEveningPassedToday}
                        onClick={() => {
                          setSessionPreset('evening')
                          setDialogError(null)
                        }}
                        className={`session-preset-btn ${
                          sessionPreset === 'evening' ? 'preset-active' : ''
                        }`}
                      >
                        <Clock size={15} aria-hidden="true" />
                        <span>Evening (5:00 PM to 8:30 PM)</span>
                      </button>

                      <button
                        type="button"
                        role="radio"
                        aria-checked={sessionPreset === 'custom'}
                        onClick={() => {
                          setSessionPreset('custom')
                          setDialogError(null)
                        }}
                        className={`session-preset-btn ${
                          sessionPreset === 'custom' ? 'preset-active' : ''
                        }`}
                      >
                        <Clock size={15} aria-hidden="true" />
                        <span>Custom times</span>
                      </button>
                    </div>
                  </div>

                  {/* Custom times row */}
                  {sessionPreset === 'custom' && (
                    <div className="specific-hours-row">
                      <div className="form-group-modern">
                        <label htmlFor="custom-time-from" className="form-label-modern">
                          From <span className="required-star">*</span>
                        </label>
                        <select
                          id="custom-time-from"
                          value={effectiveStartTime}
                          onChange={(e) => {
                            setCustomStartTime(e.target.value)
                            setDialogError(null)
                          }}
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
                        <label htmlFor="custom-time-until" className="form-label-modern">
                          Until <span className="required-star">*</span>
                        </label>
                        <select
                          id="custom-time-until"
                          value={effectiveEndTime}
                          onChange={(e) => {
                            setCustomEndTime(e.target.value)
                            setDialogError(null)
                          }}
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
                  )}
                </div>
              )}

              {/* Reason: Radio chips with icons */}
              <div className="form-group-modern">
                <label id="closure-reason-label" className="form-label-modern">
                  Reason <span className="required-star">*</span>
                </label>
                <div
                  className="closure-reason-chips"
                  role="radiogroup"
                  aria-labelledby="closure-reason-label"
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
                          type="radio"
                          name="closure-reason-step2"
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

              {/* Note (optional): revealed by quiet button */}
              <div className="form-group-modern">
                {!showNoteInput && note.trim().length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowNoteInput(true)}
                    className="btn-add-note-toggle"
                  >
                    + Add a note (optional)
                  </button>
                ) : (
                  <div className="note-revealed-box">
                    <div className="note-label-row">
                      <label htmlFor="closure-step2-note" className="form-label-modern">
                        Note <span className="optional-tag">(optional)</span>
                      </label>
                      <span
                        className={`note-char-counter ${
                          note.length >= 190 ? 'char-counter-warn' : ''
                        }`}
                        aria-live="polite"
                      >
                        {note.length}/200
                      </span>
                    </div>
                    <textarea
                      id="closure-step2-note"
                      rows={2}
                      maxLength={200}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="For example: Doctor at a dental conference"
                      className="form-input-modern form-textarea-modern"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Footer */}
            <footer className="modal-sheet-footer">
              <div className="sheet-footer-primary-wrap">
                <button
                  type="button"
                  onClick={handleGoToReview}
                  disabled={!isStep2Valid}
                  className="btn btn-primary btn-submit-sheet"
                >
                  Next →
                </button>
                {!isStep2Valid && step2Error && (
                  <span className="sheet-footer-helper-msg" role="status">
                    {step2Error}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep(1)
                  setDialogError(null)
                }}
                className="btn btn-secondary btn-cancel-sheet"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span>Back</span>
              </button>
            </footer>
          </div>
        )}

        {/* ==================================================================
            STEP 3: Check and confirm (Impact lookup + summary)
            ================================================================== */}
        {step === 3 && (
          <div className="modal-sheet-form">
            <div className="modal-scroll-area review-scroll-area">
              <div className="closure-review-summary-card">
                <span className="review-badge-label">CLOSURE SUMMARY</span>

                <div className="review-summary-row">
                  <div className="review-icon-tile">
                    <Calendar size={18} aria-hidden="true" />
                  </div>
                  <div className="review-row-text">
                    <span className="review-row-label">Time to block</span>
                    <strong className="review-row-val">{summaryWhat}</strong>
                  </div>
                </div>

                <div className="review-summary-row">
                  <div className="review-icon-tile">
                    <UserX size={18} aria-hidden="true" />
                  </div>
                  <div className="review-row-text">
                    <span className="review-row-label">Reason</span>
                    <strong className="review-row-val">{reasonLabel}</strong>
                  </div>
                </div>

                {note.trim() && (
                  <div className="review-summary-row">
                    <div className="review-icon-tile">
                      <MoreHorizontal size={18} aria-hidden="true" />
                    </div>
                    <div className="review-row-text">
                      <span className="review-row-label">Staff note</span>
                      <span className="review-row-note">“{note.trim()}”</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Existing Bookings Impact Box */}
              {checkingBookings ? (
                <div className="review-lookup-loading">
                  <Loader2 size={18} className="spinner-inline" aria-hidden="true" />
                  <span>Checking bookings for this window...</span>
                </div>
              ) : previewBookings.length > 0 ? (
                <div className="review-bookings-impact-box box-amber" role="alert">
                  <div className="impact-header">
                    <AlertTriangle size={18} className="impact-icon-amber" aria-hidden="true" />
                    <strong>
                      {previewBookings.length} existing{' '}
                      {previewBookings.length === 1 ? 'booking falls' : 'bookings fall'} in this
                      time.
                    </strong>
                  </div>
                  <p className="impact-desc">
                    They will NOT be cancelled automatically. You will see the list next so you
                    can move or cancel them and call the patients.
                  </p>
                  <ul className="preview-bookings-list">
                    {previewBookings.slice(0, 5).map((b) => (
                      <li key={b.id} className="preview-booking-item">
                        <strong className="preview-patient">{b.patient_name || 'Patient'}</strong>
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

            {/* Sticky Footer */}
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
                  setStep(2)
                  setDialogError(null)
                }}
                disabled={isSaving}
                className="btn btn-secondary btn-cancel-sheet"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span>Back</span>
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
