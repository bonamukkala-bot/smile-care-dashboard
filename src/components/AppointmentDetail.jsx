import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Phone,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  CalendarClock,
  CalendarCheck,
  User,
  Clock,
  Sparkles,
  UserCheck,
  CheckCircle2,
  UserX,
  XCircle,
  RotateCcw,
  Loader2,
  AlertCircle,
  Plus,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  formatIST,
  formatSlotRange,
  formatAppointmentStatus,
  getAppointmentStatusColor,
  invokeManageAppointment,
  formatDoctorName,
  getISTDateKey,
  formatISTDateLabel,
} from '../lib/helpers'
import StatusTrack from './StatusTrack'
import MoveBookingModal from './MoveBookingModal'
import NewBookingModal from './NewBookingModal'
import Toast from './Toast'

export default function AppointmentDetail({ currentUserId }) {
  const { id } = useParams()
  const [resolvedUserId, setResolvedUserId] = useState(null)
  const userId = currentUserId || resolvedUserId

  const [appointment, setAppointment] = useState(null)
  const [doctorName, setDoctorName] = useState('Doctor')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Status mutation & confirmation states
  const [isSaving, setIsSaving] = useState(false)
  const [savingTarget, setSavingTarget] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null) // 'no_show' | 'cancelled' | 'booked' | null

  // Shared toast state
  const [toast, setToast] = useState(null) // { message, type }

  // Modals state
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [showNewBooking, setShowNewBooking] = useState(false)

  // Copy phone state
  const [copied, setCopied] = useState(false)

  // Audit log once per page visit
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
          setError('This booking could not be found.')
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
        console.error('Failed to load appointment detail:', err?.message || err)
        setError('Unable to load appointment details. Please check your connection.')
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
  }, [id, reloadKey])

  // Audit log for view_appointment (once per page visit, NEVER use .select())
  useEffect(() => {
    if (!appointment || !userId || hasAuditedViewRef.current) return
    hasAuditedViewRef.current = true

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

  const handleCopyPhone = async () => {
    if (!appointment?.patient_phone) return
    try {
      await navigator.clipboard.writeText(appointment.patient_phone)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  // Regular status update (Arrived, Completed, No-show, Set back to Booked)
  const executeStatusUpdate = async (newStatus) => {
    setIsSaving(true)
    setSavingTarget(newStatus)
    setSaveError(null)
    setConfirmTarget(null)

    try {
      const { data, error: updateErr } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', Number(id))
        .select()

      if (updateErr || !data || data.length !== 1) {
        throw updateErr || new Error('Could not save status. Please try again.')
      }

      setAppointment((prev) => ({ ...prev, status: newStatus }))

      const labels = {
        arrived: 'Marked as arrived',
        completed: 'Marked as completed',
        no_show: 'Marked as no-show',
        booked: 'Status set back to Booked',
      }
      setToast({
        message: labels[newStatus] || 'Status updated',
        type: 'success',
      })
    } catch (err) {
      console.error('Failed to update status:', err?.message || err)
      setSaveError('Could not save status. Please try again.')
    } finally {
      setIsSaving(false)
      setSavingTarget(null)
    }
  }

  // Cancel booking action (calls manage-appointment edge function)
  const executeCancelBooking = async () => {
    setIsSaving(true)
    setSavingTarget('cancelled')
    setSaveError(null)
    setConfirmTarget(null)

    try {
      const res = await invokeManageAppointment({
        action: 'cancel',
        appointment_id: Number(id),
      })

      if (res.ok) {
        setAppointment((prev) => ({ ...prev, status: 'cancelled' }))
        setToast({
          message: 'Booking cancelled and removed from the calendar',
          type: 'success',
        })
      } else {
        setSaveError(res.error || 'Could not cancel booking. Please try again.')
      }
    } catch (err) {
      console.error('Failed to cancel booking:', err)
      setSaveError(err?.message || 'Could not cancel booking. Please try again.')
    } finally {
      setIsSaving(false)
      setSavingTarget(null)
    }
  }

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

  const handleMoveSuccess = (msg) => {
    setToast({
      message: msg || 'Booking moved on the calendar',
      type: 'success',
    })
    setReloadKey((prev) => prev + 1)
  }

  const handleNewBookingSuccess = (msg) => {
    setToast({
      message: msg || 'Booking added to the calendar',
      type: 'success',
    })
    setReloadKey((prev) => prev + 1)
  }

  // Helper for Telugu/unicode safe initials
  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return ''
    const words = name.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return ''
    if (words.length === 1) {
      return Array.from(words[0])[0].toUpperCase()
    }
    const first = Array.from(words[0])[0].toUpperCase()
    const second = Array.from(words[1])[0].toUpperCase()
    return `${first}${second}`
  }

  const renderStatusIcon = (st) => {
    switch (st) {
      case 'booked':
        return <CalendarClock size={16} aria-hidden="true" />
      case 'confirmed':
        return <CalendarCheck size={16} aria-hidden="true" />
      case 'arrived':
        return <UserCheck size={16} aria-hidden="true" />
      case 'completed':
        return <CheckCircle2 size={16} aria-hidden="true" />
      case 'no_show':
        return <UserX size={16} aria-hidden="true" />
      case 'cancelled':
        return <XCircle size={16} aria-hidden="true" />
      default:
        return <CalendarClock size={16} aria-hidden="true" />
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <header className="page-header">
          <Link to="/appointments" className="btn btn-back">
            <ArrowLeft size={18} aria-hidden="true" />
            <span>Back to Appointments</span>
          </Link>
        </header>
        <div className="detail-loading-skeleton" aria-busy="true">
          <div className="skeleton-card skeleton-detail-hero" />
          <div className="skeleton-card skeleton-detail-actions" />
        </div>
      </div>
    )
  }

  if (error || !appointment) {
    return (
      <div className="page-container">
        <header className="page-header">
          <Link to="/appointments" className="btn btn-back">
            <ArrowLeft size={18} aria-hidden="true" />
            <span>Back to Appointments</span>
          </Link>
        </header>
        <div className="card error-card-modern" role="alert">
          <AlertCircle size={32} className="error-icon" aria-hidden="true" />
          <h2 className="error-title">This booking could not be found.</h2>
          <p className="error-text">
            {error || 'The requested appointment does not exist or was removed.'}
          </p>
          <div className="error-actions-row">
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="btn btn-primary"
            >
              Try Again
            </button>
            <Link to="/appointments" className="btn btn-secondary">
              Return to Appointments
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const phone = appointment.patient_phone || ''
  const statusColor = getAppointmentStatusColor(appointment.status)
  const statusLabel = formatAppointmentStatus(appointment.status)
  const timeRange = formatSlotRange(appointment.slot_start)
  const dateKey = getISTDateKey(appointment.slot_start)
  const longDateStr = formatISTDateLabel(dateKey)
  const sourceLabel = appointment.source === 'ai' ? 'AI booked' : 'Staff'
  const isCancelled = appointment.status === 'cancelled'
  const canMove = appointment.status === 'booked' || appointment.status === 'confirmed'
  const initials = getInitials(appointment.patient_name)

  return (
    <div className="page-container detail-page-container">
      {/* Toast alert */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Back Header */}
      <header className="page-header">
        <Link to="/appointments" className="btn btn-back">
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Back to Appointments</span>
        </Link>
      </header>

      {/* Main Appointment Detail Card */}
      <article className="card appointment-detail-card" aria-label="Appointment details">
        {/* Header: Avatar, Name, Phone & Status */}
        <div className="detail-hero-header">
          <div className="detail-patient-identity">
            <div className="patient-avatar-gradient" aria-hidden="true">
              {initials ? initials : <User size={24} />}
            </div>
            <div className="detail-name-phone-col">
              <h1 className="detail-patient-heading">
                {appointment.patient_name || 'Patient'}
              </h1>

              <div className="detail-phone-row">
                {phone ? (
                  <>
                    <a
                      href={`tel:${phone}`}
                      className="detail-phone-link font-mono"
                      title="Tap to call patient"
                      aria-label={`Call ${phone}`}
                    >
                      <Phone size={15} aria-hidden="true" />
                      <span>{phone}</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      className="btn-phone-copy"
                      title="Copy phone number"
                      aria-label="Copy phone number"
                    >
                      {copied ? (
                        <Check size={14} className="copy-check" aria-hidden="true" />
                      ) : (
                        <Copy size={14} aria-hidden="true" />
                      )}
                    </button>
                  </>
                ) : (
                  <span className="detail-no-phone">No phone number</span>
                )}
              </div>
            </div>
          </div>

          <div className="detail-status-col">
            <span className={`badge status-pill status-pill-${statusColor} status-pill-large`}>
              {renderStatusIcon(appointment.status)}
              <span>{statusLabel}</span>
            </span>
          </div>
        </div>

        {/* Primary Call Patient Button (if phone present) */}
        {phone && (
          <div className="detail-call-button-row">
            <a
              href={`tel:${phone}`}
              className="btn btn-primary btn-call-primary"
              title={`Call ${appointment.patient_name || 'patient'}`}
            >
              <Phone size={18} aria-hidden="true" />
              <span>Call patient ({phone})</span>
            </a>
          </div>
        )}

        {/* Status Stepper Track */}
        <div className="detail-stepper-divider" />
        <StatusTrack status={appointment.status} />
        <div className="detail-stepper-divider" />

        {/* 2-Column Info Grid */}
        <div className="detail-info-grid">
          <div className="info-tile">
            <div className="info-tile-icon-wrap">
              <Calendar size={18} className="tile-icon" aria-hidden="true" />
            </div>
            <div className="info-tile-content">
              <span className="info-tile-label">Date & Time</span>
              <strong className="info-tile-val">{longDateStr}</strong>
              <span className="info-tile-subval">{timeRange} (IST)</span>
            </div>
          </div>

          <div className="info-tile">
            <div className="info-tile-icon-wrap">
              <User size={18} className="tile-icon" aria-hidden="true" />
            </div>
            <div className="info-tile-content">
              <span className="info-tile-label">Doctor</span>
              <strong className="info-tile-val">{formatDoctorName(doctorName)}</strong>
            </div>
          </div>

          <div className="info-tile">
            <div className="info-tile-icon-wrap">
              <Sparkles size={18} className="tile-icon" aria-hidden="true" />
            </div>
            <div className="info-tile-content">
              <span className="info-tile-label">Source</span>
              <strong className="info-tile-val">{sourceLabel}</strong>
            </div>
          </div>

          <div className="info-tile">
            <div className="info-tile-icon-wrap">
              <Clock size={18} className="tile-icon" aria-hidden="true" />
            </div>
            <div className="info-tile-content">
              <span className="info-tile-label">Booked on</span>
              <strong className="info-tile-val">{formatIST(appointment.created_at)}</strong>
            </div>
          </div>
        </div>

        {/* Reason for Visit */}
        {appointment.reason && (
          <div className="detail-reason-container">
            <span className="detail-reason-label">Reason for visit</span>
            <p className="detail-reason-content">{appointment.reason}</p>
          </div>
        )}

        {/* Link to Call Detail if call_id exists */}
        {appointment.call_id && (
          <div className="detail-call-link-box">
            <Link
              to={`/calls/${appointment.call_id}`}
              className="btn btn-secondary btn-open-call-detail"
            >
              <ExternalLink size={16} aria-hidden="true" />
              <span>Open call detail</span>
            </Link>
          </div>
        )}
      </article>

      {/* Status Management Actions Card */}
      <section className="card detail-actions-card" aria-label="Update booking status">
        <h2 className="detail-actions-heading">Update this booking</h2>

        {/* Error notice */}
        {saveError && (
          <div className="modal-alert-error mb-16" role="alert" aria-live="polite">
            <AlertCircle size={18} className="alert-error-icon" aria-hidden="true" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Inline Confirmation Box (for Cancel, No-show, or Set back to Booked) */}
        {confirmTarget && (
          <div className="booking-confirm-panel mb-16" role="alert" aria-live="assertive">
            <p className="confirm-main-prompt">
              {confirmTarget === 'cancelled'
                ? 'Cancel this booking and remove it from Google Calendar?'
                : confirmTarget === 'no_show'
                ? 'Mark this appointment as No-show?'
                : 'Set status back to Booked?'}
            </p>
            {confirmTarget === 'cancelled' && (
              <p className="confirm-sub-prompt">
                This will automatically remove the appointment from Google Calendar.
              </p>
            )}

            <div className="confirm-panel-actions mt-10">
              <button
                type="button"
                onClick={() => {
                  if (confirmTarget === 'cancelled') {
                    executeCancelBooking()
                  } else {
                    executeStatusUpdate(confirmTarget)
                  }
                }}
                disabled={isSaving}
                className={`btn ${
                  confirmTarget === 'cancelled' ? 'btn-danger' : 'btn-primary'
                } btn-confirm-action`}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="spinner-inline" aria-hidden="true" />
                    <span>Saving...</span>
                  </>
                ) : confirmTarget === 'cancelled' ? (
                  'Yes, cancel booking'
                ) : (
                  'Yes, update status'
                )}
              </button>
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                disabled={isSaving}
                className="btn btn-secondary btn-confirm-cancel"
              >
                {confirmTarget === 'cancelled' ? 'No, keep it' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* 1. If Booked or Confirmed: Move to another time + Segmented Arrived/Completed/No-show + Cancel button */}
        {canMove && (
          <div className="actions-booked-flow">
            <button
              type="button"
              onClick={() => setShowMoveModal(true)}
              disabled={isSaving}
              className="btn btn-secondary btn-move-prominent"
            >
              <Calendar size={18} aria-hidden="true" />
              <span>Move to another time</span>
            </button>

            <div className="detail-actions-segmented-row">
              <div
                className="segmented-status-group detail-segmented-group"
                role="group"
                aria-label="Direct status updates"
              >
                <button
                  type="button"
                  onClick={() => handleStatusButtonClick('arrived')}
                  disabled={isSaving || appointment.status === 'arrived'}
                  className={`btn btn-segment ${
                    appointment.status === 'arrived' ? 'segment-active' : ''
                  }`}
                >
                  {isSaving && savingTarget === 'arrived' ? (
                    <Loader2 size={15} className="spinner-inline" />
                  ) : (
                    <UserCheck size={15} aria-hidden="true" />
                  )}
                  <span>Arrived</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStatusButtonClick('completed')}
                  disabled={isSaving || appointment.status === 'completed'}
                  className={`btn btn-segment ${
                    appointment.status === 'completed' ? 'segment-active' : ''
                  }`}
                >
                  {isSaving && savingTarget === 'completed' ? (
                    <Loader2 size={15} className="spinner-inline" />
                  ) : (
                    <CheckCircle2 size={15} aria-hidden="true" />
                  )}
                  <span>Completed</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStatusButtonClick('no_show')}
                  disabled={isSaving || appointment.status === 'no_show'}
                  className={`btn btn-segment ${
                    appointment.status === 'no_show' ? 'segment-active' : ''
                  }`}
                >
                  {isSaving && savingTarget === 'no_show' ? (
                    <Loader2 size={15} className="spinner-inline" />
                  ) : (
                    <UserX size={15} aria-hidden="true" />
                  )}
                  <span>No-show</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleStatusButtonClick('cancelled')}
                disabled={isSaving}
                className="btn btn-outline-danger btn-cancel-detail"
                aria-label="Cancel this booking"
              >
                {isSaving && savingTarget === 'cancelled' ? (
                  <Loader2 size={15} className="spinner-inline" />
                ) : (
                  <XCircle size={15} aria-hidden="true" />
                )}
                <span>Cancel booking</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. If Arrived, Completed, or No-show: Segmented buttons + Set back to Booked */}
        {!canMove && !isCancelled && (
          <div className="actions-arrived-completed-flow">
            <div
              className="segmented-status-group detail-segmented-group"
              role="group"
              aria-label="Direct status updates"
            >
              <button
                type="button"
                onClick={() => handleStatusButtonClick('arrived')}
                disabled={isSaving || appointment.status === 'arrived'}
                className={`btn btn-segment ${
                  appointment.status === 'arrived' ? 'segment-active' : ''
                }`}
              >
                {isSaving && savingTarget === 'arrived' ? (
                  <Loader2 size={15} className="spinner-inline" />
                ) : (
                  <UserCheck size={15} aria-hidden="true" />
                )}
                <span>Arrived</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusButtonClick('completed')}
                disabled={isSaving || appointment.status === 'completed'}
                className={`btn btn-segment ${
                  appointment.status === 'completed' ? 'segment-active' : ''
                }`}
              >
                {isSaving && savingTarget === 'completed' ? (
                  <Loader2 size={15} className="spinner-inline" />
                ) : (
                  <CheckCircle2 size={15} aria-hidden="true" />
                )}
                <span>Completed</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusButtonClick('no_show')}
                disabled={isSaving || appointment.status === 'no_show'}
                className={`btn btn-segment ${
                  appointment.status === 'no_show' ? 'segment-active' : ''
                }`}
              >
                {isSaving && savingTarget === 'no_show' ? (
                  <Loader2 size={15} className="spinner-inline" />
                ) : (
                  <UserX size={15} aria-hidden="true" />
                )}
                <span>No-show</span>
              </button>
            </div>

            <div className="undo-row mt-14">
              <button
                type="button"
                onClick={() => handleStatusButtonClick('booked')}
                disabled={isSaving}
                className="btn btn-secondary btn-undo-booked"
              >
                <RotateCcw size={16} aria-hidden="true" />
                <span>↺ Set back to Booked</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. If Cancelled: no status buttons, only restore text + New Booking button */}
        {isCancelled && (
          <div className="cancelled-restore-container">
            <p className="cancelled-restore-text">
              To restore this slot, make a new booking.
            </p>
            <button
              type="button"
              onClick={() => setShowNewBooking(true)}
              className="btn btn-primary btn-new-booking-from-cancelled"
            >
              <Plus size={18} aria-hidden="true" />
              <span>+ New booking</span>
            </button>
          </div>
        )}

        {/* Synchronisation note under actions */}
        <p className="sync-note-muted">
          Creating, moving and cancelling bookings updates Google Calendar. Arrived,
          Completed and No-show do not.
        </p>
      </section>

      {/* Move Booking Modal */}
      {showMoveModal && (
        <MoveBookingModal
          isOpen={showMoveModal}
          onClose={() => setShowMoveModal(false)}
          onSuccess={handleMoveSuccess}
          appointment={appointment}
        />
      )}

      {/* New Booking Modal (for restore in cancelled state) */}
      {showNewBooking && (
        <NewBookingModal
          isOpen={showNewBooking}
          onClose={() => setShowNewBooking(false)}
          onSuccess={handleNewBookingSuccess}
          initialDate={dateKey}
        />
      )}
    </div>
  )
}
