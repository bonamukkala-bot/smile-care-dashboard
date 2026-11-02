import { useState, useEffect, useRef } from 'react'
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
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [bookings, setBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [removeError, setRemoveError] = useState(null)

  // Track if closure is active right now using pure state + timer
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

  // Fetch bookings still to handle (refresh on mount, focus, and every 60s)
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
  const dateRangeLabel = formatClosureDateRange(closure.start_at, closure.end_at)
  const windowLabel = formatClosureWindow(closure.start_at, closure.end_at)
  const addedAgo = formatTimeAgo(closure.created_at)

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
      className={`card closure-card ${isEmergency ? 'closure-card-emergency' : 'closure-card-standard'}`}
      aria-label={`Closure: ${reasonLabel}, ${dateRangeLabel}`}
    >
      <div className="closure-card-main">
        {/* Top meta row: Reason badge + ACTIVE NOW tag + Added time */}
        <div className="closure-card-top-meta">
          <div className="closure-badges-group">
            <span
              className={`closure-reason-badge ${
                isEmergency ? 'reason-badge-emergency' : 'reason-badge-standard'
              }`}
            >
              {getReasonIcon(closure.reason)}
              <span>{reasonLabel}</span>
            </span>

            {isActiveNow && (
              <span className="closure-active-now-tag" role="status">
                <span className="active-dot-pulsing" aria-hidden="true" />
                ACTIVE NOW
              </span>
            )}
          </div>

          {addedAgo && (
            <span className="closure-added-time">Added {addedAgo}</span>
          )}
        </div>

        {/* Date and Time window */}
        <div className="closure-card-time-row">
          <h3 className="closure-card-date">{dateRangeLabel}</h3>
          <span className="closure-card-window-pill">
            <Clock size={14} aria-hidden="true" />
            <span>{windowLabel}</span>
          </span>
        </div>

        {/* Note if present */}
        {closure.note && (
          <p className="closure-card-note">{closure.note}</p>
        )}

        {/* Bookings to handle status bar */}
        <div className="closure-card-bookings-bar">
          {loadingBookings ? (
            <div className="closure-bookings-loading-pill">
              <Loader2 size={15} className="spinner-inline" aria-hidden="true" />
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
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                <strong>{bookings.length}</strong> {bookings.length === 1 ? 'booking' : 'bookings'} to handle
              </span>
              {expanded ? (
                <ChevronUp size={16} aria-hidden="true" />
              ) : (
                <ChevronDown size={16} aria-hidden="true" />
              )}
            </button>
          ) : (
            <span className="closure-no-bookings-pill" role="status">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>No bookings affected</span>
            </span>
          )}

          {/* Remove closure trigger button */}
          {!confirmRemove && (
            <button
              type="button"
              onClick={() => {
                setConfirmRemove(true)
                setRemoveError(null)
              }}
              className="btn btn-secondary btn-sm btn-remove-closure"
              aria-label="Remove this closure"
            >
              <Trash2 size={15} aria-hidden="true" />
              <span>Remove closure</span>
            </button>
          )}
        </div>

        {/* Inline Confirmation for Removing Closure */}
        {confirmRemove && (
          <div className="closure-confirm-remove-box" role="alert">
            <p className="confirm-remove-prompt">
              Remove this closure? The blocked times will open again on the calendar and can be booked.
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
                    <Loader2 size={15} className="spinner-inline" aria-hidden="true" />
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

      {/* Expandable Bookings to Handle Section */}
      {expanded && (
        <div className="closure-card-expanded-area">
          <div className="expanded-divider" />
          <div className="expanded-content">
            <h4 className="expanded-title">
              Bookings falling in this closure window
            </h4>
            <AffectedBookingsList bookings={bookings} loading={loadingBookings} />
          </div>
        </div>
      )}
    </article>
  )
}
