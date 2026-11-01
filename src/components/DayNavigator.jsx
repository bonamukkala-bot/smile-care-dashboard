import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

export default function DayNavigator({
  selectedDate,
  todayIST,
  formattedDateLabel,
  onPrevDay,
  onNextDay,
  onToday,
  onDateChange,
}) {
  const isToday = selectedDate === todayIST

  return (
    <section className="card day-navigator-card" aria-label="Date Navigation">
      <div className="day-nav-actions">
        <button
          type="button"
          onClick={onPrevDay}
          className="btn btn-secondary day-step-btn"
          aria-label="Previous day"
        >
          <ChevronLeft size={18} aria-hidden="true" />
          <span>Previous day</span>
        </button>

        <button
          type="button"
          onClick={onToday}
          className={`btn ${isToday ? 'btn-today-active' : 'btn-secondary'} day-today-btn`}
          aria-pressed={isToday}
        >
          Today
        </button>

        <button
          type="button"
          onClick={onNextDay}
          className="btn btn-secondary day-step-btn"
          aria-label="Next day"
        >
          <span>Next day</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="day-nav-divider" />

      <div className="day-nav-display-row">
        <div className="day-heading-group">
          <h2 className="day-heading-text">{formattedDateLabel}</h2>
          {isToday && (
            <span className="today-badge-pill" role="status">
              <span className="today-dot" aria-hidden="true" />
              TODAY
            </span>
          )}
        </div>

        <div className="day-picker-wrapper">
          <Calendar size={18} className="day-picker-icon" aria-hidden="true" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) {
                onDateChange(e.target.value)
              }
            }}
            className="filter-input day-date-input"
            aria-label="Jump to date"
          />
        </div>
      </div>
    </section>
  )
}

