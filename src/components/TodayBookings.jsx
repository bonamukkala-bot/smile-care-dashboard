import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  getTodayIST,
  getISTDateRange,
  getISTDateKey,
  formatISTDateLabel,
  formatISTTimeShort,
  maskPhone,
  formatAppointmentStatus,
  getAppointmentStatusColor,
} from '../lib/helpers'

export default function TodayBookings() {
  const [selectedDate, setSelectedDate] = useState(() => getTodayIST())
  const [appointments, setAppointments] = useState([])
  const [doctors, setDoctors] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Status mutation state per card
  const [savingId, setSavingId] = useState(null)
  const [saveErrors, setSaveErrors] = useState({})
  // Confirmation state: { apptId, targetStatus }
  const [confirmState, setConfirmState] = useState(null)

  // Ref to track if saving or waiting for confirmation (for skipping auto-refresh)
  const isBusy = savingId !== null || confirmState !== null
  const isBusyRef = useRef(isBusy)

  useEffect(() => {
    isBusyRef.current = isBusy
  }, [isBusy])

  // 1. Fetch doctors table once on mount
  useEffect(() => {
    let isMounted = true

    async function loadDoctors() {
      try {
        const { data, error: docError } = await supabase
          .from('doctors')
          .select('id, name')

        if (!isMounted) return
        if (docError) {
          console.error('Failed to load doctors:', docError.message)
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

  // 2. Fetch appointments for selectedDate
  useEffect(() => {
    let isMounted = true

    async function loadAppointments(isSilent = false) {
      if (!isSilent) {
        setLoading(true)
      }
      setError(null)

      try {
        const { startUTC, endUTC } = getISTDateRange(selectedDate)

        const { data, error: apptError } = await supabase
          .from('appointments')
          .select(
            'id, call_id, doctor_id, patient_name, patient_phone, reason, slot_start, status, source'
          )
          .gte('slot_start', startUTC)
          .lte('slot_start', endUTC)
          .order('slot_start', { ascending: true })

        if (!isMounted) return
        if (apptError) throw apptError

        setAppointments(data || [])
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to load appointments:', err.message || err)
        setError('Unable to load bookings. Please check your connection and try again.')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadAppointments(false)

    // Auto-refresh every 60s, but not while saving or confirming
    const interval = setInterval(() => {
      if (isMounted && !isBusyRef.current) {
        loadAppointments(true)
      }
    }, 60000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [selectedDate, reloadKey])

  // Date switch handlers
  const handlePrevDay = () => {
    const d = new Date(`${selectedDate}T12:00:00+05:30`)
    d.setDate(d.getDate() - 1)
    setSelectedDate(getISTDateKey(d))
    setConfirmState(null)
  }

  const handleNextDay = () => {
    const d = new Date(`${selectedDate}T12:00:00+05:30`)
    d.setDate(d.getDate() + 1)
    setSelectedDate(getISTDateKey(d))
    setConfirmState(null)
  }

  const handleToday = () => {
    setSelectedDate(getTodayIST())
    setConfirmState(null)
  }

  // Status update execution
  const executeStatusUpdate = async (apptId, newStatus) => {
    setSavingId(apptId)
    setSaveErrors((prev) => ({ ...prev, [apptId]: null }))
    setConfirmState(null)

    try {
      const { data, error: updateError } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', apptId)
        .select()

      if (updateError || !data || data.length !== 1) {
        setSaveErrors((prev) => ({
          ...prev,
          [apptId]: 'Could not save. Please try again.',
        }))
      } else {
        // Update local state without reload
        setAppointments((prev) =>
          prev.map((a) => (a.id === apptId ? { ...a, status: newStatus } : a))
        )
      }
    } catch {
      setSaveErrors((prev) => ({
        ...prev,
        [apptId]: 'Could not save. Please try again.',
      }))
    } finally {
      setSavingId(null)
    }
  }

  // Status button tap router
  const handleStatusClick = (appt, targetStatus) => {
    if (appt.status === targetStatus) return

    if (targetStatus === 'no_show' || targetStatus === 'cancelled') {
      setConfirmState({ apptId: appt.id, targetStatus })
      setSaveErrors((prev) => ({ ...prev, [appt.id]: null }))
    } else {
      executeStatusUpdate(appt.id, targetStatus)
    }
  }

  const handleCancelConfirm = () => {
    setConfirmState(null)
  }

  // Summary counts
  const summaryLine = useMemo(() => {
    const count = appointments.length
    if (count === 0) return '0 bookings'

    const counts = {}
    for (const a of appointments) {
      counts[a.status] = (counts[a.status] || 0) + 1
    }

    const order = ['booked', 'confirmed', 'arrived', 'completed', 'no_show', 'cancelled']
    const parts = []
    for (const s of order) {
      if (counts[s]) {
        parts.push(`${counts[s]} ${formatAppointmentStatus(s).toLowerCase()}`)
      }
    }

    const countText = `${count} ${count === 1 ? 'booking' : 'bookings'}`
    return parts.length > 0 ? `${countText} • ${parts.join(', ')}` : countText
  }, [appointments])

  const todayIST = getTodayIST()
  const isToday = selectedDate === todayIST
  const formattedDateLabel = formatISTDateLabel(selectedDate)

  return (
    <div className="page-container">
      <header className="page-header">
        <Link to="/" className="btn btn-back">
          ← Back
        </Link>
        <h1 className="page-heading">Today's Bookings</h1>
      </header>

      {/* Notice note at top */}
      <div className="calendar-sync-notice" role="note">
        Changing a status here does not change Google Calendar. The calendar stays the main record.
      </div>

      {/* Date Switcher */}
      <section className="card date-switcher-card" aria-label="Date Navigation">
        <div className="date-nav-buttons">
          <button
            type="button"
            onClick={handlePrevDay}
            className="btn btn-secondary btn-date-step"
            title="Previous day"
          >
            ← Previous day
          </button>
          <button
            type="button"
            onClick={handleToday}
            className={`btn btn-secondary btn-today ${isToday ? 'btn-today-active' : ''}`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={handleNextDay}
            className="btn btn-secondary btn-date-step"
            title="Next day"
          >
            Next day →
          </button>
        </div>

        <div className="date-display-row">
          <div className="date-label-badge">
            <span className="current-date-text">{formattedDateLabel}</span>
            {isToday && <span className="today-chip">Today</span>}
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) {
                setSelectedDate(e.target.value)
                setConfirmState(null)
              }
            }}
            className="filter-input date-picker-input"
            aria-label="Pick date"
          />
        </div>
      </section>

      {/* Summary line */}
      <div className="bookings-summary-bar">
        <span className="summary-count-text">{summaryLine}</span>
      </div>

      {/* Main Bookings List */}
      <main className="bookings-content">
        {loading && (
          <div className="loading-card">
            <div className="spinner" aria-hidden="true" />
            <p className="loading-text">Loading bookings...</p>
          </div>
        )}

        {!loading && error && (
          <div className="card error-card">
            <p className="error-text">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true)
                setError(null)
                setReloadKey((prev) => prev + 1)
              }}
              className="btn btn-primary"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && appointments.length === 0 && (
          <div className="card empty-card">
            <p className="empty-title">No bookings for this day</p>
            <p className="empty-subtitle">
              There are no scheduled appointments for {formattedDateLabel}.
            </p>
          </div>
        )}

        {!loading && !error && appointments.length > 0 && (
          <div className="bookings-list">
            {appointments.map((appt) => {
              const timeString = formatISTTimeShort(appt.slot_start)
              const doctorName = doctors[appt.doctor_id] || 'Doctor'
              const maskedPhone = maskPhone(appt.patient_phone)
              const hasPhone = appt.patient_phone && appt.patient_phone.trim() !== ''
              const statusColor = getAppointmentStatusColor(appt.status)
              const statusLabel = formatAppointmentStatus(appt.status)
              const isCancelled = appt.status === 'cancelled'
              const sourceLabel = appt.source === 'ai' ? 'AI booked' : 'Staff'
              const isSaving = savingId === appt.id
              const saveError = saveErrors[appt.id]
              const isConfirming =
                confirmState && confirmState.apptId === appt.id

              return (
                <article
                  key={appt.id}
                  className={`card booking-card ${
                    isCancelled ? 'booking-card-cancelled' : ''
                  }`}
                >
                  {/* Card Top: Time, Doctor & Status badge */}
                  <div className="booking-card-top">
                    <div className="time-doctor-group">
                      <span className="booking-time-large">{timeString}</span>
                      <span className="booking-doctor-name">with {doctorName}</span>
                    </div>

                    <div className="booking-badge-group">
                      <span className="source-tag">{sourceLabel}</span>
                      <span
                        className={`badge status-badge status-badge-${statusColor}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </div>

                  {/* Card Body: Patient info & Phone */}
                  <div className="booking-card-body">
                    <div className="patient-name-row">
                      <h2 className="patient-display-name">{appt.patient_name || 'Patient'}</h2>
                      <div className="phone-action-row">
                        <span className="patient-masked-phone">{maskedPhone}</span>
                        {hasPhone && (
                          <a
                            href={`tel:${appt.patient_phone}`}
                            className="btn btn-call-tel"
                            title="Call patient"
                          >
                            📞 Call
                          </a>
                        )}
                      </div>
                    </div>

                    {appt.reason && (
                      <p className="booking-reason-text">
                        <span className="reason-label">Reason: </span>
                        {appt.reason}
                      </p>
                    )}
                  </div>

                  {/* Open call link if call_id exists */}
                  {appt.call_id && (
                    <div className="booking-call-link-row">
                      <Link
                        to={`/calls/${appt.call_id}`}
                        className="btn btn-secondary btn-open-call-link"
                      >
                        Open call
                      </Link>
                    </div>
                  )}

                  {/* Error Alert if save failed */}
                  {saveError && (
                    <div className="save-error-notice" role="alert">
                      {saveError}
                    </div>
                  )}

                  {/* Confirmation Prompt for No-show / Cancelled */}
                  {isConfirming && (
                    <div className="confirm-action-box" role="alert">
                      <p className="confirm-prompt-text">
                        {confirmState.targetStatus === 'no_show'
                          ? 'Mark as no-show?'
                          : 'Mark as cancelled?'}
                      </p>
                      <div className="confirm-btn-row">
                        <button
                          type="button"
                          onClick={() =>
                            executeStatusUpdate(appt.id, confirmState.targetStatus)
                          }
                          disabled={isSaving}
                          className="btn btn-primary btn-confirm-yes"
                        >
                          {isSaving ? 'Saving...' : 'Yes'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelConfirm}
                          disabled={isSaving}
                          className="btn btn-secondary btn-confirm-no"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Status Action Buttons */}
                  <div className="booking-status-buttons">
                    <button
                      type="button"
                      onClick={() => handleStatusClick(appt, 'arrived')}
                      disabled={isSaving || appt.status === 'arrived'}
                      className={`btn btn-status-opt ${
                        appt.status === 'arrived' ? 'status-btn-active' : ''
                      }`}
                    >
                      Arrived
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusClick(appt, 'completed')}
                      disabled={isSaving || appt.status === 'completed'}
                      className={`btn btn-status-opt ${
                        appt.status === 'completed' ? 'status-btn-active' : ''
                      }`}
                    >
                      Completed
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusClick(appt, 'no_show')}
                      disabled={isSaving || appt.status === 'no_show'}
                      className={`btn btn-status-opt ${
                        appt.status === 'no_show' ? 'status-btn-active' : ''
                      }`}
                    >
                      No-show
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusClick(appt, 'cancelled')}
                      disabled={isSaving || appt.status === 'cancelled'}
                      className={`btn btn-status-opt ${
                        appt.status === 'cancelled' ? 'status-btn-active' : ''
                      }`}
                    >
                      Cancelled
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
