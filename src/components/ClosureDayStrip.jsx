import { useMemo } from 'react'
import {
  Check,
  AlertTriangle,
  Clock,
  CalendarOff,
} from 'lucide-react'
import {
  getTodayIST,
  isSundayIST,
  addDaysToISTDate,
  formatClosureWindow,
} from '../lib/helpers'

/**
 * 14-day horizontally scrollable day strip:
 * Shows each of the next 14 days with weekday, day number, and status badge
 * (Open, Closed, Partly closed, Sunday).
 * Tapping an open/partly closed day opens AddClosureDialog at Step 2 with that date.
 */
export default function ClosureDayStrip({ closures = [], onSelectDate }) {
  const todayIST = useMemo(() => getTodayIST(), [])

  // Generate 14 days starting from today in IST
  const days = useMemo(() => {
    const list = []
    for (let i = 0; i < 14; i++) {
      const dateKey = addDaysToISTDate(todayIST, i)
      const d = new Date(`${dateKey}T12:00:00+05:30`)
      const isSunday = isSundayIST(dateKey)
      const isToday = dateKey === todayIST

      const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
      }).format(d)

      const dayNum = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
      }).format(d)

      const monthName = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
      }).format(d)

      // Find overlapping closures for this day
      const dayStartUTC = new Date(`${dateKey}T00:00:00+05:30`).toISOString()
      const dayEndUTC = new Date(`${dateKey}T23:59:59.999+05:30`).toISOString()

      const overlapping = closures.filter(
        (cl) => cl.start_at < dayEndUTC && cl.end_at > dayStartUTC
      )

      let status = 'open' // 'open' | 'closed' | 'partly' | 'sunday'
      let isEmergency = false

      if (isSunday) {
        status = 'sunday'
      } else if (overlapping.length > 0) {
        isEmergency = overlapping.some((c) => c.reason === 'emergency')
        const hasFullDay = overlapping.some((c) => {
          const win = formatClosureWindow(c.start_at, c.end_at)
          return win === 'Full day'
        })
        status = hasFullDay ? 'closed' : 'partly'
      }

      list.push({
        dateKey,
        weekday,
        dayNum,
        monthName,
        isSunday,
        isToday,
        status,
        isEmergency,
      })
    }
    return list
  }, [todayIST, closures])

  return (
    <section className="closure-day-strip-section" aria-label="Next 14 days clinic status">
      <div className="day-strip-header">
        <h2 className="day-strip-title">Next 14 days</h2>
        <span className="day-strip-hint">Tap any day to plan a closure</span>
      </div>

      {/* Horizontally scrollable strip */}
      <div className="day-strip-scroll-container" role="region" aria-label="14 day status strip">
        <div className="day-strip-track">
          {days.map((day) => {
            const isClickable = day.status !== 'sunday'

            return (
              <button
                key={day.dateKey}
                type="button"
                disabled={!isClickable}
                onClick={() => {
                  if (isClickable) {
                    onSelectDate?.(day.dateKey)
                  }
                }}
                className={`day-strip-tile ${day.isToday ? 'tile-is-today' : ''} tile-status-${
                  day.status
                } ${day.isEmergency ? 'tile-emergency' : ''}`}
                aria-label={`${day.weekday} ${day.dayNum} ${day.monthName}: ${day.status}${
                  day.isToday ? ' (Today)' : ''
                }`}
              >
                {day.isToday && <span className="tile-today-pill">Today</span>}
                <span className="tile-weekday">{day.weekday}</span>
                <span className="tile-daynum">{day.dayNum}</span>

                {/* Status indicator */}
                <div className="tile-status-indicator">
                  {day.status === 'sunday' && (
                    <span className="tile-status-badge badge-sunday">
                      <CalendarOff size={11} aria-hidden="true" />
                      <span>Sunday</span>
                    </span>
                  )}
                  {day.status === 'closed' && (
                    <span
                      className={`tile-status-badge ${
                        day.isEmergency ? 'badge-emergency' : 'badge-closed'
                      }`}
                    >
                      <AlertTriangle size={11} aria-hidden="true" />
                      <span>Closed</span>
                    </span>
                  )}
                  {day.status === 'partly' && (
                    <span className="tile-status-badge badge-partly">
                      <Clock size={11} aria-hidden="true" />
                      <span>Partly</span>
                    </span>
                  )}
                  {day.status === 'open' && (
                    <span className="tile-status-badge badge-open">
                      <Check size={11} aria-hidden="true" />
                      <span>Open</span>
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* One-line legend */}
      <div className="day-strip-legend" aria-hidden="true">
        <span className="legend-item">
          <span className="legend-dot dot-open" /> Open
        </span>
        <span className="legend-item">
          <span className="legend-dot dot-partly" /> Partly closed
        </span>
        <span className="legend-item">
          <span className="legend-dot dot-closed" /> Closed
        </span>
        <span className="legend-item">
          <span className="legend-dot dot-sunday" /> Sunday (closed)
        </span>
      </div>
    </section>
  )
}

