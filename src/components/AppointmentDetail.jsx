import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  formatIST,
  formatSlotRange,
  formatAppointmentStatus,
  getAppointmentStatusColor,
} from '../lib/helpers'

export default function AppointmentDetail({ currentUserId }) {
  const { id } = useParams()
  const [resolvedUserId, setResolvedUserId] = useState(null)
  const userId = currentUserId || resolvedUserId

  const [appointment, setAppointment] = useState(null)
  const [doctorName, setDoctorName] = useState('Doctor')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Status mutation & confirmation states
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null) // 'no_show' | 'cancelled' | 'booked' | null

  // Part 6: Audit log once per page visit
  const hasAuditedViewRef = useRef(false)

  // Resolve user id if not provided via props
  useEffect(() => {
    if (currentUserId) return
    let isMounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted && session?.user?.id) {
        setResolvedUserId(session.user.id)
      }
    })

    return () => {
      isMounted = false
    }
  }, [currentUserId])

  // Load appointment and doctor info
  useEffect(() => {
    let isMounted = true

    async function loadAppointmentData() {
      if (!id) return
      setLoading(true)
      setError(null)

      try {
        const { data: apptData, error: apptErr } = await supabase
          .from('appointments')
          .select(
            'id, call_id, doctor_id, patient_name, patient_phone, reason, slot_start, status, source, created_at'
          )
          .eq('id', id)
          .maybeSingle()

        if (!isMounted) return
        if (apptErr) throw apptErr

        if (!apptData) {
          setError('Appointment not found.')
          return
        }

        setAppointment(apptData)

        // Lookup doctor name
        if (apptData.doctor_id) {
          const { data: docData } = await supabase
            .from('doctors')
            .select('name')
            .eq('id', apptData.doctor_id)
            .maybeSingle()

          if (isMounted && docData?.name) {
            setDoctorName(docData.name)
          }
        }
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to load appointment detail:', err.message || err)
        setError('Unable to load appointment details. Please try again.')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadAppointmentData()

    return () => {
      isMounted = false
    }
  }, [id])

  // Part 6: Audit log for view_appointment (once per page visit)
  useEffect(() => {
    if (!appointment || !userId || hasAuditedViewRef.current) return
    hasAuditedViewRef.current = true

    // Insert view_appointment into audit_log; silently ignore any error; NEVER use .select()
    supabase
      .from('audit_log')
      .insert({
        action: 'view_appointment',
        details: 'Opened appointment detail and full phone number',
        user_id: userId,
        call_id: appointment.call_id ? Number(appointment.call_id) : null,
      })
      .then(() => {})
      .catch(() => {})
  }, [appointment, userId])

  // Status mutation logic
  const executeStatusUpdate = async (newStatus) => {
    setIsSaving(true)
    setSaveError(null)
    setConfirmTarget(null)

    try {
      const { data, error: updateErr } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', Number(id))
        .select()

      if (updateErr || !data || data.length !== 1) {
        throw updateErr || new Error('Could not save. Please try again.')
      }

      setAppointment((prev) => ({ ...prev, status: newStatus }))
    } catch (err) {
      console.error('Failed to update status:', err.message || err)
      setSaveError('Could not save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle status button click
  const handleStatusButtonClick = (targetStatus) => {
    if (appointment?.status === targetStatus) return

    // Require confirmation for No-show, Cancelled, and Set back to Booked
    if (
      targetStatus === 'no_show' ||
      targetStatus === 'cancelled' ||
      targetStatus === 'booked'
    ) {
      setConfirmTarget(targetStatus)
      setSaveError(null)
    } else {
      executeStatusUpdate(targetStatus)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <header className="page-header">
          <Link to="/appointments" className="btn btn-back">
            ← Back to Appointments
          </Link>
        </header>
        <div className="loading-card">
          <div className="spinner" aria-hidden="true" />
          <p className="loading-text">Loading appointment details...</p>
        </div>
      </div>
    )
  }

  if (error || !appointment) {
    return (
      <div className="page-container">
        <header className="page-header">
          <Link to="/appointments" className="btn btn-back">
            ← Back to Appointments
          </Link>
        </header>
        <div className="card error-card">
          <p className="error-text">{error || 'Appointment not found.'}</p>
          <Link to="/appointments" className="btn btn-primary">
            Return to Appointments
          </Link>
        </div>
      </div>
    )
  }

  const phone = appointment.patient_phone || ''
  const statusColor = getAppointmentStatusColor(appointment.status)
  const statusLabel = formatAppointmentStatus(appointment.status)
  const timeRange = formatSlotRange(appointment.slot_start)
  const dateFormatted = formatIST(appointment.slot_start)
  const sourceLabel = appointment.source === 'ai' ? 'AI booked' : 'Staff'
  const isBooked = appointment.status === 'booked'

  const getConfirmPromptMessage = () => {
    if (confirmTarget === 'no_show') return 'Mark as no-show?'
    if (confirmTarget === 'cancelled') return 'Mark as cancelled?'
    if (confirmTarget === 'booked') return 'Set status back to Booked?'
    return 'Confirm status change?'
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <Link to="/appointments" className="btn btn-back">
          ← Back to Appointments
        </Link>
      </header>

      {/* Synchronisation note */}
      <div className="calendar-sync-notice" role="note">
        Status changes here do not change Google Calendar yet.
      </div>

      {/* Main Appointment Detail Card */}
      <article className="card call-top-card">
        <div className="top-header-row">
          <div>
            <h1 className="detail-caller-name">
              {appointment.patient_name || 'Patient'}
            </h1>
            <div className="phone-row">
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  className="tel-link"
                  title="Tap to call patient"
                >
                  📞 {phone}
                </a>
              ) : (
                <span className="tel-link-disabled">No phone number</span>
              )}
            </div>
          </div>
          <span className={`badge status-badge status-badge-${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        <div className="detail-meta-grid">
          <div className="meta-box">
            <span className="meta-label">Date & Time</span>
            <span className="meta-value">{dateFormatted}</span>
            <span className="meta-subvalue">({timeRange})</span>
          </div>

          <div className="meta-box">
            <span className="meta-label">Doctor</span>
            <span className="meta-value">Dr. {doctorName}</span>
          </div>

          <div className="meta-box">
            <span className="meta-label">Source</span>
            <span className="meta-value">{sourceLabel}</span>
          </div>

          <div className="meta-box">
            <span className="meta-label">Booked on (Created)</span>
            <span className="meta-value">{formatIST(appointment.created_at)}</span>
          </div>
        </div>

        {appointment.reason && (
          <div className="detail-reason-box">
            <span className="meta-label">Reason for visit</span>
            <p className="detail-reason-text">{appointment.reason}</p>
          </div>
        )}

        {/* Link to Call if call_id exists */}
        {appointment.call_id && (
          <div className="call-link-wrapper">
            <Link
              to={`/calls/${appointment.call_id}`}
              className="btn btn-secondary btn-open-call-link"
            >
              📞 Open call detail
            </Link>
          </div>
        )}
      </article>

      {/* Status Management Actions Card */}
      <section className="card detail-section-card">
        <h2 className="section-title">Manage Appointment Status</h2>

        {saveError && (
          <div className="alert alert-error" role="alert">
            {saveError}
          </div>
        )}

        {/* Confirmation prompt */}
        {confirmTarget && (
          <div className="confirm-action-box" role="alert">
            <p className="confirm-prompt-text">{getConfirmPromptMessage()}</p>
            <div className="confirm-btn-row">
              <button
                type="button"
                onClick={() => executeStatusUpdate(confirmTarget)}
                disabled={isSaving}
                className="btn btn-primary btn-confirm-yes"
              >
                {isSaving ? 'Saving...' : 'Yes'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                disabled={isSaving}
                className="btn btn-secondary btn-confirm-no"
              >
                No
              </button>
            </div>
          </div>
        )}

        {/* Primary Status Buttons */}
        <div className="booking-status-buttons mt-16">
          <button
            type="button"
            onClick={() => handleStatusButtonClick('arrived')}
            disabled={isSaving || appointment.status === 'arrived'}
            className={`btn btn-status-opt ${
              appointment.status === 'arrived' ? 'status-btn-active' : ''
            }`}
          >
            Arrived
          </button>

          <button
            type="button"
            onClick={() => handleStatusButtonClick('completed')}
            disabled={isSaving || appointment.status === 'completed'}
            className={`btn btn-status-opt ${
              appointment.status === 'completed' ? 'status-btn-active' : ''
            }`}
          >
            Completed
          </button>

          <button
            type="button"
            onClick={() => handleStatusButtonClick('no_show')}
            disabled={isSaving || appointment.status === 'no_show'}
            className={`btn btn-status-opt ${
              appointment.status === 'no_show' ? 'status-btn-active' : ''
            }`}
          >
            No-show
          </button>

          <button
            type="button"
            onClick={() => handleStatusButtonClick('cancelled')}
            disabled={isSaving || appointment.status === 'cancelled'}
            className={`btn btn-status-opt ${
              appointment.status === 'cancelled' ? 'status-btn-active' : ''
            }`}
          >
            Cancelled
          </button>
        </div>

        {/* Undo / Set back to Booked button */}
        {!isBooked && (
          <div className="undo-status-row">
            <button
              type="button"
              onClick={() => handleStatusButtonClick('booked')}
              disabled={isSaving}
              className="btn btn-secondary btn-undo-booked"
            >
              ↺ Set back to Booked
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

