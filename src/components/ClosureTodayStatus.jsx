import { useMemo } from 'react'
import {
  CheckCircle2,
  CalendarOff,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import {
  getTodayIST,
  isSundayIST,
  canCloseRestOfToday,
  formatClosureReason,
  formatClosureWindow,
} from '../lib/helpers'

/**
 * "Today" status card at top of Closures screen:
 * - Open today (green) with normal hours + quick "Close rest of today" button
 * - Sunday (muted) "The clinic is closed today (Sunday)"
 * - Closed / partly closed today (amber/red) with reason, window and note
 */
export default function ClosureTodayStatus({ todayClosure, onOpenAdd }) {
  const todayIST = useMemo(() => getTodayIST(), [])
  const isSunday = useMemo(() => isSundayIST(todayIST), [todayIST])
  const canQuickClose = useMemo(() => canCloseRestOfToday(), [])

  // If today is Sunday
  if (isSunday) {
    return (
      <div className="card closure-today-card today-closed-sunday" role="status">
        <div className="today-status-icon-tile tile-muted">
          <CalendarOff size={24} aria-hidden="true" />
        </div>
        <div className="today-status-body">
          <span className="today-status-badge badge-muted">SUNDAY</span>
          <h2 className="today-status-title">The clinic is closed today (Sunday)</h2>
          <p className="today-status-sub">
            The clinic is closed every Sunday. Normal hours resume tomorrow.
          </p>
        </div>
      </div>
    )
  }

  // If there is an active closure overlapping today
  if (todayClosure) {
    const isEmergency = todayClosure.reason === 'emergency'
    const reasonLabel = formatClosureReason(todayClosure.reason)
    const windowLabel = formatClosureWindow(todayClosure.start_at, todayClosure.end_at)
    const isFullDay = windowLabel === 'Full day'

    return (
      <div
        className={`card closure-today-card ${
          isEmergency ? 'today-closed-emergency' : 'today-closed-standard'
        }`}
        role="status"
      >
        <div
          className={`today-status-icon-tile ${
            isEmergency ? 'tile-emergency' : 'tile-warning'
          }`}
        >
          <AlertTriangle size={24} aria-hidden="true" />
        </div>
        <div className="today-status-body">
          <div className="today-badge-row">
            <span
              className={`today-status-badge ${
                isEmergency ? 'badge-emergency' : 'badge-warning'
              }`}
            >
              CLOSED TODAY
            </span>
            <span className="today-window-pill">
              <Clock size={13} aria-hidden="true" />
              <span>{windowLabel}</span>
            </span>
          </div>
          <h2 className="today-status-title">Closed today: {reasonLabel}</h2>
          {todayClosure.note && (
            <p className="today-status-note">“{todayClosure.note}”</p>
          )}
        </div>
        {!isFullDay && canQuickClose && (
          <div className="today-status-action">
            <button
              type="button"
              onClick={() => onOpenAdd?.({ type: 'rest_of_today' })}
              className="btn btn-secondary btn-sm"
              aria-label="Close the remaining hours today"
            >
              <Clock size={15} aria-hidden="true" />
              <span>Close rest of today</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  // Normal open day
  return (
    <div className="card closure-today-card today-status-open" role="status">
      <div className="today-status-icon-tile tile-success">
        <CheckCircle2 size={24} aria-hidden="true" />
      </div>
      <div className="today-status-body">
        <div className="today-badge-row">
          <span className="today-status-badge badge-success">OPEN TODAY</span>
        </div>
        <h2 className="today-status-title">The clinic is open today</h2>
        <p className="today-status-sub">
          Normal operating hours: <strong>10:00 AM to 1:30 PM</strong> and{' '}
          <strong>5:00 PM to 8:30 PM</strong>.
        </p>
      </div>
      {canQuickClose && (
        <div className="today-status-action">
          <button
            type="button"
            onClick={() => onOpenAdd?.({ type: 'rest_of_today' })}
            className="btn btn-secondary btn-quick-close-today"
            aria-label="Quickly close the rest of today for emergencies or leave"
          >
            <Clock size={16} aria-hidden="true" />
            <span>Close rest of today</span>
          </button>
        </div>
      )}
    </div>
  )
}

