import { useState, useEffect, useRef, useMemo } from 'react'
import {
  UserX,
  CalendarDays,
  AlertTriangle,
  Sun,
  MoreHorizontal,
  Trash2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  formatClosureReason,
  formatClosureWindow,
  formatClosureDateRange,
  formatTimeAgo,
  getTodayIST,
  addDaysToISTDate,
  getISTDateKey,
  invokeManageClosure,
} from '../lib/helpers'
import AffectedBookingsList from './AffectedBookingsList'

function getReasonIcon(reason) {
  switch (reason) {
    case 'doctor_leave':
      return <UserX size={16} className="reason-icon" aria-hidden="true" />
    case 'event':
      return <CalendarDays size={16} className="reason-icon" aria-hidden="true" />
    case 'emergency':
      return <AlertTriangle size={16} className="reason-icon" aria-hidden="true" />
    case 'holiday':
      return <Sun size={16} className="reason-icon" aria-hidden="true" />
    case 'other':
    default:
      return <MoreHorizontal size={16} className="reason-icon" aria-hidden="true" />
  }
}

export default function ClosureCard({
  closure,
  onRemoved,
  defaultExpanded = false,
  isHighlighted = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [bookings, setBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [removeError, setRemoveError] = useState(null)

  // Track if closure is actively occurring right now using pure state + interval
  const [isActiveNow, setIsActiveNow] = useState(() => {
    const now = Date.now()
    const startMs = new Date(closure.start_at).getTime()
    const endMs = new Date(closure.end_at).getTime()
    return now >= startMs && now <= endMs
  })

  useEffect(() => {
    const checkActive = () => {
      const now = Date.now()
      const startMs = new Date(closure.start_at).getTime()
      const endMs = new Date(closure.end_at).getTime()
      setIsActiveNow(now >= startMs && now <= endMs)
    }
    const timer = setInterval(checkActive, 30000)
    return () => clearInterval(timer)
  }, [closure.start_at, closure.end_at])

  const cardRef = useRef(null)

  // Scroll into view if expanded initially
  useEffect(() => {
    if (defaultExpanded && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [defaultExpanded])

  // Fetch bookings still to handle for this closure
  useEffect(() => {
    let isMounted = true

    async function fetchBookings() {
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('id, patient_name, patient_phone, slot_start, status, reason')
          .eq('doctor_id', 1)
          .in('status', ['booked', 'confirmed'])
          .gte('slot_start', closure.start_at)
          .lt('slot_start', closure.end_at)
          .order('slot_start', { ascending: true })

        if (!isMounted) return
        if (error) {
          console.error('Error fetching closure bookings:', error.message)
        } else {
          setBookings(data || [])
        }
      } catch (err) {
        console.error('Unexpected error fetching closure bookings:', err)
      } finally {
        if (isMounted) setLoadingBookings(false)
      }
    }

    fetchBookings()

    const interval = setInterval(fetchBookings, 60000)

    const handleFocus = () => {
      fetchBookings()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      isMounted = false
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [closure.start_at, closure.end_at])

  const isEmergency = closure.reason === 'emergency'
  const reasonLabel = formatClosureReason(closure.reason)
  const windowLabel = formatClosureWindow(closure.start_at, closure.end_at)
  const addedAgo = formatTimeAgo(closure.created_at)

  // Date tile labels (Month + Day)
  const { tileMonth, tileDay, isMultiDay } = useMemo(() => {
    try {
      const s = new Date(closure.start_at)
      const e = new Date(closure.end_at)
      const sKey = getISTDateKey(s)
      const eKey = getISTDateKey(e)
      const isMulti = sKey !== eKey

      const sMonth = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
      })
        .format(s)
        .toUpperCase()

      const sDay = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
      }).format(s)

      if (!isMulti) {
        return { tileMonth: sMonth, tileDay: sDay, isMultiDay: false }
      }

      const eDay = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
      }).format(e)

      return {
        tileMonth: sMonth,
        tileDay: `${sDay}–${eDay}`,
        isMultiDay: true,
      }
    } catch {
      return { tileMonth: 'DATE', tileDay: '-', isMultiDay: false }
    }
  }, [closure.start_at, closure.end_at])

  // Plain words time description
  const plainTimeLabel = useMemo(() => {
    if (isMultiDay) {
      return formatClosureDateRange(closure.start_at, closure.end_at)
    }
    if (windowLabel === 'Full day') {
      return 'Whole day'
    }
    return windowLabel
  }, [isMultiDay, closure.start_at, closure.end_at, windowLabel])

  // Relative timing chip
  const relativeChip = useMemo(() => {
    if (isActiveNow) {
      return { label: 'Happening now', isPulsing: true }
    }
    const today = getTodayIST()
    const tomorrow = addDaysToISTDate(today, 1)
    const startKey = getISTDateKey(closure.start_at)

    if (startKey === today) {
      return { label: 'Today', isPulsing: false }
    }
    if (startKey === tomorrow) {
      return { label: 'Tomorrow', isPulsing: false }
    }
    if (startKey > tomorrow) {
      const sDate = new Date(`${startKey}T12:00:00+05:30`)
      const tDate = new Date(`${today}T12:00:00+05:30`)
      const diffDays = Math.round((sDate - tDate) / (1000 * 60 * 60 * 24))
      return { label: `In ${diffDays} days`, isPulsing: false }
    }
    return null
  }, [isActiveNow, closure.start_at])

  // Note display condition: non-empty AND not repeat of reason label (case-insensitive)
  const cleanNote = (closure.note || '').trim()
  const showNote =
    cleanNote.length > 0 &&
    cleanNote.toLowerCase() !== reasonLabel.toLowerCase() &&
    cleanNote.toLowerCase() !== (closure.reason || '').toLowerCase()

  const handleRemove = async () => {
    if (isRemoving) return
    setIsRemoving(true)
    setRemoveError(null)

    try {
      const res = await invokeManageClosure({
        action: 'remove',
        closure_id: closure.id,
      })

      if (!res.ok) {
        setRemoveError(res.error || 'Failed to remove closure. Please try again.')
        setIsRemoving(false)
        return
      }

      onRemoved?.(closure.id)
    } catch (err) {
      setRemoveError(err?.message || 'Failed to remove closure. Please try again.')
      setIsRemoving(false)
    }
  }

  return (
    <article
      ref={cardRef}
      className={`card closure-card ${
        isEmergency ? 'closure-card-emergency' : 'closure-card-standard'
      } ${isHighlighted ? 'closure-card-highlighted' : ''}`}
      aria-label={`Closure: ${reasonLabel}, ${plainTimeLabel}`}
    >
      <div className="closure-card-inner-layout">
        {/* Date Tile on Left */}
        <div className="closure-date-tile" aria-hidden="true">
          <span className="closure-tile-month">{tileMonth}</span>
          <span className="closure-tile-day">{tileDay}</span>
        </div>

        {/* Main Content Area */}
        <div className="closure-card-body">
          {/* Top row: Reason title + relative chip */}
          <div className="closure-body-header">
            <div className="closure-title-group">
              <span
                className={`closure-reason-tag ${
                  isEmergency ? 'tag-emergency' : 'tag-standard'
                }`}
              >
                {getReasonIcon(closure.reason)}
                <span>{reasonLabel}</span>
              </span>

              {relativeChip && (
                <span
                  className={`closure-relative-chip ${
                    relativeChip.isPulsing ? 'chip-happening-now' : ''
                  }`}
                  role={relativeChip.isPulsing ? 'status' : undefined}
                >
                  {relativeChip.isPulsing && (
                    <span className="active-dot-pulsing" aria-hidden="true" />
                  )}
                  {relativeChip.label}
                </span>
              )}
            </div>

            {addedAgo && (
              <span className="closure-added-time">Added {addedAgo}</span>
            )}
          </div>

          {/* Plain-words time description */}
          <div className="closure-time-desc-row">
            <Clock size={15} className="closure-clock-icon" aria-hidden="true" />
            <strong className="closure-plain-time">{plainTimeLabel}</strong>
          </div>

          {/* Quote note if present and meaningful */}
          {showNote && (
            <p className="closure-quote-note">“{cleanNote}”</p>
          )}

          {/* Footer Bar: Impact callout + Remove trigger */}
          <div className="closure-card-footer-bar">
            {loadingBookings ? (
              <div className="closure-bookings-loading-pill">
                <Loader2 size={14} className="spinner-inline" aria-hidden="true" />
                <span>Checking affected bookings...</span>
              </div>
            ) : bookings.length > 0 ? (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="btn btn-closure-handle-bookings"
                aria-expanded={expanded}
                aria-label={`${bookings.length} bookings to handle. Click to ${
                  expanded ? 'collapse' : 'expand'
                } list.`}
              >
                <AlertTriangle size={15} aria-hidden="true" />
                <span>
                  <strong>{bookings.length}</strong>{' '}
                  {bookings.length === 1 ? 'booking' : 'bookings'} to handle
                </span>
                {expanded ? (
                  <ChevronUp size={15} aria-hidden="true" />
                ) : (
                  <ChevronDown size={15} aria-hidden="true" />
                )}
              </button>
            ) : (
              <span className="closure-no-bookings-pill" role="status">
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>No bookings affected</span>
              </span>
            )}

            {!confirmRemove && (
              <button
                type="button"
                onClick={() => {
                  setConfirmRemove(true)
                  setRemoveError(null)
                }}
                className="btn-remove-closure-quiet"
                aria-label="Remove this closure"
              >
                <Trash2 size={14} aria-hidden="true" />
                <span>Remove closure</span>
              </button>
            )}
          </div>

          {/* Inline confirmation for remove */}
          {confirmRemove && (
            <div className="closure-confirm-remove-box" role="alert">
              <p className="confirm-remove-prompt">
                Remove this closure? The blocked times will open again on the calendar and
                can be booked.
              </p>

              {removeError && (
                <div className="closure-inline-error" role="alert">
                  <AlertTriangle size={15} aria-hidden="true" />
                  <span>{removeError}</span>
                </div>
              )}

              <div className="confirm-remove-actions">
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isRemoving}
                  className="btn btn-danger btn-sm"
                >
                  {isRemoving ? (
                    <>
                      <Loader2 size={14} className="spinner-inline" aria-hidden="true" />
                      <span>Removing...</span>
                    </>
                  ) : (
                    'Yes, remove closure'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmRemove(false)
                    setRemoveError(null)
                  }}
                  disabled={isRemoving}
                  className="btn btn-secondary btn-sm"
                >
                  No, keep it
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Affected Bookings List */}
      {expanded && (
        <div className="closure-card-expanded-area">
          <div className="expanded-divider" />
          <div className="expanded-content">
            <AffectedBookingsList bookings={bookings} loading={loadingBookings} />
          </div>
        </div>
      )}
    </article>
  )
}
