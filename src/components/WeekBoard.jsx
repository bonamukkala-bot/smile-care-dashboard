import { Link } from 'react-router-dom'
import {
  CalendarClock,
  CalendarCheck,
  UserCheck,
  CheckCircle2,
  UserX,
  XCircle,
  Sparkles,
} from 'lucide-react'
import {
  formatISTTimeShort,
  formatAppointmentStatus,
  getAppointmentStatusColor,
  isSundayIST,
} from '../lib/helpers'

export default function WeekBoard({
  weekDays = [],
  weekGroupedByDay = {},
  todayIST,
  onSelectDay,
}) {
  const renderStatusIcon = (status) => {
    switch (status) {
      case 'booked':
        return <CalendarClock size={12} aria-hidden="true" />
      case 'confirmed':
        return <CalendarCheck size={12} aria-hidden="true" />
      case 'arrived':
        return <UserCheck size={12} aria-hidden="true" />
      case 'completed':
        return <CheckCircle2 size={12} aria-hidden="true" />
      case 'no_show':
        return <UserX size={12} aria-hidden="true" />
      case 'cancelled':
        return <XCircle size={12} aria-hidden="true" />
      default:
        return <CalendarClock size={12} aria-hidden="true" />
    }
  }

  const renderCompactTile = (appt) => {
    const timeStr = formatISTTimeShort(appt.slot_start)
    const patientName = appt.patient_name || 'Patient'
    const statusColor = getAppointmentStatusColor(appt.status)
    const statusLabel = formatAppointmentStatus(appt.status)
    const isCancelled = appt.status === 'cancelled'
    const sourceLabel = appt.source === 'ai' ? 'AI' : 'Staff'

    return (
      <article
        key={appt.id}
        className={`week-tile week-tile-stripe-${statusColor} ${
          isCancelled ? 'week-tile-cancelled' : ''
        }`}
      >
        <Link
          to={`/appointments/${appt.id}`}
          className="week-tile-overlay-link"
          aria-label={`View appointment for ${patientName} at ${timeStr}`}
        >
          <span className="visually-hidden">
            View appointment for {patientName} at {timeStr}
          </span>
        </Link>

        <div className="week-tile-top">
          <span className="week-tile-time">{timeStr}</span>
          <span className="week-tile-source">
            {appt.source === 'ai' && <Sparkles size={10} aria-hidden="true" />}
            {sourceLabel}
          </span>
        </div>

        <h4 className="week-tile-name" title={patientName}>
          {patientName}
        </h4>

        <div className="week-tile-footer">
          <span className={`badge week-status-pill week-status-${statusColor}`}>
            {renderStatusIcon(appt.status)}
            <span>{statusLabel}</span>
          </span>
        </div>
      </article>
    )
  }

  return (
    <div className="week-board-container" role="region" aria-label="7-day Week Appointments Board">
      {weekDays.map((dayKey) => {
        const dayBookings = weekGroupedByDay[dayKey] || []
        const isToday = dayKey === todayIST
        const isSunday = isSundayIST(dayKey)

        // Parse day name & number
        const dateObj = new Date(`${dayKey}T12:00:00+05:30`)
        const shortDayName = dateObj.toLocaleDateString('en-US', {
          weekday: 'short',
          timeZone: 'Asia/Kolkata',
        })
        const dayNumber = dateObj.toLocaleDateString('en-US', {
          day: 'numeric',
          timeZone: 'Asia/Kolkata',
        })

        return (
          <section
            key={dayKey}
            className={`week-board-col ${isToday ? 'col-today' : ''} ${
              isSunday ? 'col-sunday' : ''
            }`}
          >
            {/* Clickable Column Header opens Day view */}
            <button
              type="button"
              onClick={() => onSelectDay(dayKey)}
              className="week-col-header-btn"
              title={`Switch to Day view for ${shortDayName} ${dayNumber}`}
              aria-label={`Switch to Day view for ${shortDayName} ${dayNumber}, ${dayBookings.length} bookings`}
            >
              <div className="week-header-day-info">
                <span className="week-header-dayname">{shortDayName}</span>
                <span className="week-header-daynum">{dayNumber}</span>
              </div>
              <div className="week-header-meta">
                {isToday && (
                  <span className="today-micro-badge" aria-hidden="true">
                    TODAY
                  </span>
                )}
                <span className="week-count-pill">{dayBookings.length}</span>
              </div>
            </button>

            {/* Column Body */}
            <div className="week-col-body">
              {isSunday ? (
                <div className="week-closed-notice">
                  <span>Closed</span>
                </div>
              ) : dayBookings.length === 0 ? (
                <div className="week-empty-dash" aria-label="No appointments">
                  <span className="dash-desktop" aria-hidden="true">
                    —
                  </span>
                  <span className="dash-mobile">No bookings</span>
                </div>
              ) : (
                <div className="week-tiles-list">
                  {dayBookings.map(renderCompactTile)}
                </div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

