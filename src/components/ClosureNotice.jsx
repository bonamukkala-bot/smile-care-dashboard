import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CalendarOff, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  getTodayIST,
  getISTDateRange,
  formatClosureReason,
  formatClosureWindow,
  formatISTDateLabel,
} from '../lib/helpers'

export default function ClosureNotice({ dateStr, isHome = false, compact = false }) {
  const [closures, setClosures] = useState([])
  const [unhandledCount, setUnhandledCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadClosureNotice() {
      if (!dateStr) {
        if (isMounted) setLoading(false)
        return
      }

      try {
        const { startUTC, endUTC } = getISTDateRange(dateStr)

        // Query active closures that overlap the given day
        const { data: closuresData, error: closureErr } = await supabase
          .from('closures')
          .select('id, start_at, end_at, reason, note, status')
          .eq('status', 'active')
          .lt('start_at', endUTC)
          .gt('end_at', startUTC)
          .order('start_at', { ascending: true })

        if (!isMounted) return

        if (closureErr || !closuresData || closuresData.length === 0) {
          setClosures([])
          setUnhandledCount(0)
          setLoading(false)
          return
        }

        setClosures(closuresData)

        // Query bookings still to handle for these closures
        let totalUnhandled = 0
        for (const cl of closuresData) {
          const { count, error: apptErr } = await supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('doctor_id', 1)
            .in('status', ['booked', 'confirmed'])
            .gte('slot_start', cl.start_at)
            .lt('slot_start', cl.end_at)

          if (!apptErr && typeof count === 'number') {
            totalUnhandled += count
          }
        }

        if (isMounted) {
          setUnhandledCount(totalUnhandled)
        }
      } catch (err) {
        // Never block the page on error
        console.error('ClosureNotice error:', err)
        if (isMounted) {
          setClosures([])
          setUnhandledCount(0)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadClosureNotice()

    return () => {
      isMounted = false
    }
  }, [dateStr])

  if (loading || closures.length === 0) {
    return null
  }

  const primary = closures[0]
  const todayIST = getTodayIST()
  const isToday = dateStr === todayIST
  const windowText = formatClosureWindow(primary.start_at, primary.end_at)
  const isFullDay = windowText === 'Full day'
  const reasonText = formatClosureReason(primary.reason)

  // Construct label text
  const headingText = isToday
    ? isFullDay
      ? `Clinic closed today: ${reasonText}`
      : `Closed today ${windowText}: ${reasonText}`
    : isFullDay
      ? `Clinic closed on ${formatISTDateLabel(dateStr)}: ${reasonText}`
      : `Closed ${formatISTDateLabel(dateStr)} (${windowText}): ${reasonText}`

  // Home Screen layout
  if (isHome) {
    return (
      <section className="closure-home-notice-card" role="status" aria-label="Clinic closure notice">
        <div className="closure-notice-icon-tile">
          <CalendarOff size={22} className="closure-notice-icon" aria-hidden="true" />
        </div>
        <div className="closure-notice-content">
          <div className="closure-notice-title-row">
            <span className="closure-notice-badge">CLINIC CLOSURE</span>
            <strong className="closure-notice-title">{headingText}</strong>
          </div>
          {primary.note && (
            <p className="closure-notice-note">{primary.note}</p>
          )}
        </div>
        <div className="closure-notice-actions">
          {unhandledCount > 0 ? (
            <Link to="/closures" className="closure-unhandled-badge-link">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>
                {unhandledCount} {unhandledCount === 1 ? 'booking still needs' : 'bookings still need'} handling
              </span>
            </Link>
          ) : (
            <Link to="/closures" className="btn btn-secondary btn-sm">
              View closures
            </Link>
          )}
        </div>
      </section>
    )
  }

  // Compact layout (for TodayBookings and Appointments Day view)
  return (
    <div
      className={`closure-compact-banner ${compact ? 'closure-compact-day-view' : ''}`}
      role="status"
      aria-label="Clinic closure notification"
    >
      <div className="closure-compact-content">
        <CalendarOff size={18} className="closure-compact-icon" aria-hidden="true" />
        <span className="closure-compact-text">
          <strong>{headingText}</strong>
        </span>
        {unhandledCount > 0 && (
          <Link to="/closures" className="closure-compact-unhandled-chip">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>
              {unhandledCount} to handle
            </span>
          </Link>
        )}
      </div>
      <Link to="/closures" className="closure-compact-manage-link">
        Manage closures →
      </Link>
    </div>
  )
}
