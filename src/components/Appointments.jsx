import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  getTodayIST,
  getISTDateRange,
  getISTDateKey,
  formatISTDateLabel,
  formatSlotRange,
  getISTWeekDays,
  formatISTWeekLabel,
  maskPhone,
  formatAppointmentStatus,
  getAppointmentStatusColor,
} from '../lib/helpers'

const STATUS_OPTIONS = [
  'booked',
  'confirmed',
  'arrived',
  'completed',
  'no_show',
  'cancelled',
]

export default function Appointments() {
  const [viewMode, setViewMode] = useState('day') // 'day' | 'week' | 'list'
  const [selectedDate, setSelectedDate] = useState(() => getTodayIST())
  const [showPastList, setShowPastList] = useState(false)

  // Raw data
  const [appointments, setAppointments] = useState([])
  const [doctors, setDoctors] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Filters
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [filterDoctor, setFilterDoctor] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCancelled, setShowCancelled] = useState(false)

  // 1. Fetch doctors once on mount
  useEffect(() => {
    let isMounted = true

    async function loadDoctors() {
      try {
        const { data, error: docErr } = await supabase
          .from('doctors')
          .select('id, name')

        if (!isMounted) return
        if (docErr) {
          console.error('Failed to load doctors:', docErr.message)
          return
        }

        const map = {}
        for (const doc of data || []) {
          map[doc.id] = doc.name
        }
        setDoctors(map)
      } catch (err) {
        if (!isMounted) return
        console.error('Error fetching doctors:', err.message || err)
      }
    }

    loadDoctors()

    return () => {
      isMounted = false
    }
  }, [])

  // 2. Fetch appointments based on active view and date
  useEffect(() => {
    let isMounted = true

    async function loadAppointments() {
      setLoading(true)
      setError(null)

      try {
        let query = supabase
          .from('appointments')
          .select(
            'id, call_id, doctor_id, patient_name, patient_phone, reason, slot_start, status, source, created_at'
          )

        if (viewMode === 'day') {
          // Day range in IST
          const { startUTC, endUTC } = getISTDateRange(selectedDate)
          query = query
            .gte('slot_start', startUTC)
            .lte('slot_start', endUTC)
            .order('slot_start', { ascending: true })
        } else if (viewMode === 'week') {
          // Monday to Sunday of chosen week in IST
          const weekDays = getISTWeekDays(selectedDate)
          if (weekDays.length === 7) {
            const startUTC = getISTDateRange(weekDays[0]).startUTC
            const endUTC = getISTDateRange(weekDays[6]).endUTC
            query = query
              .gte('slot_start', startUTC)
              .lte('slot_start', endUTC)
              .order('slot_start', { ascending: true })
          }
        } else if (viewMode === 'list') {
          if (showPastList) {
            // Past 30 days up to today
            const pastDate = new Date()
            pastDate.setDate(pastDate.getDate() - 30)
            const pastStartUTC = getISTDateRange(getISTDateKey(pastDate)).startUTC
            const todayEndUTC = getISTDateRange(getTodayIST()).endUTC
            query = query
              .gte('slot_start', pastStartUTC)
              .lte('slot_start', todayEndUTC)
              .order('slot_start', { ascending: false })
              .limit(200)
          } else {
            // Upcoming from today onward
            const todayStartUTC = getISTDateRange(getTodayIST()).startUTC
            query = query
              .gte('slot_start', todayStartUTC)
              .order('slot_start', { ascending: true })
              .limit(200)
          }
        }

        const { data, error: apptErr } = await query

        if (!isMounted) return
        if (apptErr) throw apptErr

        setAppointments(data || [])
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to load appointments:', err.message || err)
        setError('Unable to load appointments. Please check your connection and try again.')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadAppointments()

    return () => {
      isMounted = false
    }
  }, [viewMode, selectedDate, showPastList, reloadKey])

  // Navigation handlers for Day view
  const handlePrevDay = () => {
    const d = new Date(`${selectedDate}T12:00:00+05:30`)
    d.setDate(d.getDate() - 1)
    setSelectedDate(getISTDateKey(d))
  }

  const handleNextDay = () => {
    const d = new Date(`${selectedDate}T12:00:00+05:30`)
    d.setDate(d.getDate() + 1)
    setSelectedDate(getISTDateKey(d))
  }

  const handleToday = () => {
    setSelectedDate(getTodayIST())
  }

  // Navigation handlers for Week view
  const weekDays = useMemo(() => getISTWeekDays(selectedDate), [selectedDate])

  const handlePrevWeek = () => {
    const d = new Date(`${selectedDate}T12:00:00+05:30`)
    d.setDate(d.getDate() - 7)
    setSelectedDate(getISTDateKey(d))
  }

  const handleNextWeek = () => {
    const d = new Date(`${selectedDate}T12:00:00+05:30`)
    d.setDate(d.getDate() + 7)
    setSelectedDate(getISTDateKey(d))
  }

  const handleThisWeek = () => {
    setSelectedDate(getTodayIST())
  }

  // Clear filters
  const handleClearFilters = () => {
    setFilterStatus('all')
    setFilterSource('all')
    setFilterDoctor('all')
    setSearchQuery('')
    setShowCancelled(false)
  }

  const hasActiveFilters =
    filterStatus !== 'all' ||
    filterSource !== 'all' ||
    filterDoctor !== 'all' ||
    Boolean(searchQuery.trim()) ||
    showCancelled

  // Apply filters
  const filteredAppointments = useMemo(() => {
    const trimmed = searchQuery.trim()
    const searchLower = trimmed.toLowerCase()
    const searchDigits = trimmed.replace(/\D/g, '')

    return appointments.filter((appt) => {
      // Cancelled visibility: hidden by default unless showCancelled is true or filterStatus is 'cancelled'
      if (!showCancelled && filterStatus !== 'cancelled' && appt.status === 'cancelled') {
        return false
      }

      // Status filter
      if (filterStatus !== 'all' && appt.status !== filterStatus) {
        return false
      }

      // Source filter
      if (filterSource !== 'all' && appt.source !== filterSource) {
        return false
      }

      // Doctor filter
      if (filterDoctor !== 'all' && String(appt.doctor_id) !== String(filterDoctor)) {
        return false
      }

      // Search filter (patient name OR phone digits)
      if (trimmed) {
        const patientName = (appt.patient_name || '').toLowerCase()
        const matchesName = patientName.includes(searchLower)

        const rawPhone = (appt.patient_phone || '').replace(/\D/g, '')
        const matchesPhone = searchDigits.length > 0 && rawPhone.includes(searchDigits)

        if (!matchesName && !matchesPhone) {
          return false
        }
      }

      return true
    })
  }, [appointments, filterStatus, filterSource, filterDoctor, searchQuery, showCancelled])

  // Groupings for views
  // 1. Day view: Grouped by doctor
  const dayGroupedByDoctor = useMemo(() => {
    const groups = {}
    for (const appt of filteredAppointments) {
      const docId = appt.doctor_id || 'unknown'
      if (!groups[docId]) {
        groups[docId] = []
      }
      groups[docId].push(appt)
    }
    return groups
  }, [filteredAppointments])

  // 2. Week view: Grouped by dayKey (YYYY-MM-DD)
  const weekGroupedByDay = useMemo(() => {
    const groups = {}
    for (const day of weekDays) {
      groups[day] = []
    }
    for (const appt of filteredAppointments) {
      const apptDateKey = getISTDateKey(appt.slot_start)
      if (groups[apptDateKey]) {
        groups[apptDateKey].push(appt)
      }
    }
    return groups
  }, [filteredAppointments, weekDays])

  // 3. List view: Grouped by dateKey
  const listGroupedByDate = useMemo(() => {
    const groups = {}
    for (const appt of filteredAppointments) {
      const apptDateKey = getISTDateKey(appt.slot_start)
      if (!groups[apptDateKey]) {
        groups[apptDateKey] = []
      }
      groups[apptDateKey].push(appt)
    }
    return groups
  }, [filteredAppointments])

  const todayIST = getTodayIST()
  const isTodaySelected = selectedDate === todayIST

  // Render individual booking card
  const renderBookingCard = (appt) => {
    const timeRange = formatSlotRange(appt.slot_start)
    const doctorName = doctors[appt.doctor_id] || 'Doctor'
    const maskedPhone = maskPhone(appt.patient_phone)
    const statusColor = getAppointmentStatusColor(appt.status)
    const statusLabel = formatAppointmentStatus(appt.status)
    const isCancelled = appt.status === 'cancelled'
    const sourceLabel = appt.source === 'ai' ? 'AI booked' : 'Staff'

    return (
      <Link
        key={appt.id}
        to={`/appointments/${appt.id}`}
        className={`card booking-card appt-item-card ${
          isCancelled ? 'booking-card-cancelled' : ''
        }`}
      >
        <div className="booking-card-top">
          <div className="time-doctor-group">
            <span className="booking-time-large">{timeRange}</span>
            <span className="booking-doctor-name">with {doctorName}</span>
          </div>

          <div className="booking-badge-group">
            <span className="source-tag">{sourceLabel}</span>
            <span className={`badge status-badge status-badge-${statusColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="booking-card-body">
          <div className="patient-name-row">
            <h4 className="patient-display-name">{appt.patient_name || 'Patient'}</h4>
            <span className="patient-masked-phone">{maskedPhone}</span>
          </div>

          {appt.reason && (
            <p className="booking-reason-text">
              <span className="reason-label">Reason: </span>
              {appt.reason}
            </p>
          )}
        </div>

        <div className="appt-card-footer">
          <span className="tap-hint">Tap to view details & update status →</span>
        </div>
      </Link>
    )
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <Link to="/" className="btn btn-back">
          ← Back
        </Link>
        <h1 className="page-heading">Appointments</h1>
      </header>

      {/* Synchronisation note */}
      <div className="calendar-sync-notice" role="note">
        Status changes here do not change Google Calendar yet.
      </div>

      {/* View Toggle Tabs */}
      <section className="view-toggle-bar" aria-label="View Mode">
        <button
          type="button"
          onClick={() => setViewMode('day')}
          className={`btn view-toggle-btn ${viewMode === 'day' ? 'view-btn-active' : ''}`}
        >
          📅 Day view
        </button>
        <button
          type="button"
          onClick={() => setViewMode('week')}
          className={`btn view-toggle-btn ${viewMode === 'week' ? 'view-btn-active' : ''}`}
        >
          🗓️ Week view
        </button>
        <button
          type="button"
          onClick={() => setViewMode('list')}
          className={`btn view-toggle-btn ${viewMode === 'list' ? 'view-btn-active' : ''}`}
        >
          📋 List view
        </button>
      </section>

      {/* Date Navigation depending on View Mode */}
      {viewMode === 'day' && (
        <section className="card date-switcher-card" aria-label="Day Navigation">
          <div className="date-nav-buttons">
            <button
              type="button"
              onClick={handlePrevDay}
              className="btn btn-secondary btn-date-step"
            >
              ← Previous day
            </button>
            <button
              type="button"
              onClick={handleToday}
              className={`btn btn-secondary btn-today ${
                isTodaySelected ? 'btn-today-active' : ''
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              className="btn btn-secondary btn-date-step"
            >
              Next day →
            </button>
          </div>

          <div className="date-display-row">
            <div className="date-label-badge">
              <span className="current-date-text">{formatISTDateLabel(selectedDate)}</span>
              {isTodaySelected && <span className="today-chip">Today</span>}
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value)
              }}
              className="filter-input date-picker-input"
              aria-label="Pick day"
            />
          </div>
        </section>
      )}

      {viewMode === 'week' && (
        <section className="card date-switcher-card" aria-label="Week Navigation">
          <div className="date-nav-buttons">
            <button
              type="button"
              onClick={handlePrevWeek}
              className="btn btn-secondary btn-date-step"
            >
              ← Previous week
            </button>
            <button
              type="button"
              onClick={handleThisWeek}
              className="btn btn-secondary btn-today"
            >
              This week
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              className="btn btn-secondary btn-date-step"
            >
              Next week →
            </button>
          </div>

          <div className="date-display-row">
            <div className="date-label-badge">
              <span className="current-date-text">
                {formatISTWeekLabel(weekDays[0], weekDays[6])}
              </span>
            </div>
          </div>
        </section>
      )}

      {viewMode === 'list' && (
        <section className="card list-view-nav-card" aria-label="List Navigation">
          <div className="list-toggle-row">
            <button
              type="button"
              onClick={() => setShowPastList(false)}
              className={`btn btn-secondary list-filter-btn ${
                !showPastList ? 'list-filter-active' : ''
              }`}
            >
              Upcoming bookings
            </button>
            <button
              type="button"
              onClick={() => setShowPastList(true)}
              className={`btn btn-secondary list-filter-btn ${
                showPastList ? 'list-filter-active' : ''
              }`}
            >
              Show past (last 30 days)
            </button>
          </div>
          <span className="list-mode-desc">
            {showPastList
              ? 'Showing past bookings from the last 30 days'
              : 'Showing upcoming bookings from today onward'}
          </span>
        </section>
      )}

      {/* Universal Filters Card */}
      <section className="card filters-card" aria-label="Appointment Filters">
        {/* Status Dropdown */}
        <div className="filter-group">
          <label htmlFor="appt-status-select" className="filter-label">
            Status
          </label>
          <select
            id="appt-status-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-input filter-select"
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {formatAppointmentStatus(st)}
              </option>
            ))}
          </select>
        </div>

        {/* Source Dropdown */}
        <div className="filter-group">
          <label htmlFor="appt-source-select" className="filter-label">
            Source
          </label>
          <select
            id="appt-source-select"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="filter-input filter-select"
          >
            <option value="all">All Sources</option>
            <option value="ai">AI booked</option>
            <option value="staff">Staff</option>
          </select>
        </div>

        {/* Doctor Dropdown */}
        <div className="filter-group">
          <label htmlFor="appt-doctor-select" className="filter-label">
            Doctor
          </label>
          <select
            id="appt-doctor-select"
            value={filterDoctor}
            onChange={(e) => setFilterDoctor(e.target.value)}
            className="filter-input filter-select"
          >
            <option value="all">All Doctors</option>
            {Object.entries(doctors).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="filter-group search-filter-group">
          <label htmlFor="appt-search-input" className="filter-label">
            Search Patient or Phone
          </label>
          <input
            id="appt-search-input"
            type="text"
            placeholder="Search by name or digits..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="filter-input search-input"
          />
        </div>

        {/* Show Cancelled & Clear Filters */}
        <div className="filter-group show-cancelled-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
              className="checkbox-input"
            />
            <span>Show cancelled</span>
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="btn btn-secondary btn-clear-filters"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {/* Main Content Area */}
      <main className="appointments-content">
        {loading && (
          <div className="loading-card">
            <div className="spinner" aria-hidden="true" />
            <p className="loading-text">Loading appointments...</p>
          </div>
        )}

        {!loading && error && (
          <div className="card error-card">
            <p className="error-text">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="btn btn-primary"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && filteredAppointments.length === 0 && (
          <div className="card empty-card">
            <p className="empty-title">
              {viewMode === 'day' ? 'No bookings for this day' : 'No bookings found'}
            </p>
            <p className="empty-subtitle">
              {hasActiveFilters
                ? 'Try adjusting your filters or search query.'
                : 'There are no appointments scheduled for this period.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="btn btn-secondary mt-16"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* 1. Day View Content (Grouped by Doctor) */}
        {!loading && !error && filteredAppointments.length > 0 && viewMode === 'day' && (
          <div className="day-view-container">
            {Object.keys(dayGroupedByDoctor).map((docId) => {
              const docName = doctors[docId] || 'Doctor'
              const docBookings = dayGroupedByDoctor[docId] || []
              return (
                <section key={docId} className="doctor-section">
                  <div className="doctor-section-header">
                    <h2 className="doctor-group-heading">
                      👨‍⚕️ {docName} ({docBookings.length})
                    </h2>
                  </div>
                  <div className="bookings-list">
                    {docBookings.map((appt) => renderBookingCard(appt))}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {/* 2. Week View Content (Monday to Sunday) */}
        {!loading && !error && viewMode === 'week' && (
          <div className="week-view-container">
            {weekDays.map((dayKey) => {
              const dayBookings = weekGroupedByDay[dayKey] || []
              const dayDateLabel = formatISTDateLabel(dayKey)
              const isToday = dayKey === todayIST

              return (
                <section
                  key={dayKey}
                  className={`card week-day-section ${
                    isToday ? 'week-day-today' : ''
                  }`}
                >
                  <div className="week-day-header">
                    <div className="week-day-title-row">
                      <h3 className="week-day-title">{dayDateLabel}</h3>
                      {isToday && <span className="today-chip">Today</span>}
                    </div>
                    <span className="week-day-count-badge">
                      {dayBookings.length} {dayBookings.length === 1 ? 'booking' : 'bookings'}
                    </span>
                  </div>

                  {dayBookings.length === 0 ? (
                    <p className="week-day-empty-text">No bookings</p>
                  ) : (
                    <div className="bookings-list mt-12">
                      {dayBookings.map((appt) => renderBookingCard(appt))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}

        {/* 3. List View Content (Grouped by Date) */}
        {!loading && !error && filteredAppointments.length > 0 && viewMode === 'list' && (
          <div className="list-view-container">
            {Object.keys(listGroupedByDate).map((dateKey) => {
              const dateBookings = listGroupedByDate[dateKey] || []
              const dateLabel = formatISTDateLabel(dateKey)
              const isToday = dateKey === todayIST

              return (
                <section key={dateKey} className="list-date-group">
                  <div className="list-date-header">
                    <h3 className="list-date-title">
                      {dateLabel} {isToday ? '(Today)' : ''}
                    </h3>
                    <span className="date-count-label">
                      {dateBookings.length} {dateBookings.length === 1 ? 'booking' : 'bookings'}
                    </span>
                  </div>

                  <div className="bookings-list">
                    {dateBookings.map((appt) => renderBookingCard(appt))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

