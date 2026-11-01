import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock,
  UserCheck,
  CheckCircle2,
  UserX,
  XCircle,
  CalendarCheck,
  CalendarClock,
  Sparkles,
  Phone,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import {
  formatISTTimeShort,
  formatSlotEndTime,
  formatAppointmentStatus,
  getAppointmentStatusColor,
  maskPhone,
  formatDoctorName,
} from '../lib/helpers'

export default function BookingCard({
  appointment,
  doctorName,
  isNextUp = false,
  isPastUnfinished = false,
  isSaving = false,
  savingTarget = null,
  isConfirming = false,
  confirmTarget = null,
  saveError = null,
  onStatusClick,
  onConfirmYes,
  onConfirmNo,
}) {
  const [copied, setCopied] = useState(false)

  const patientName = appointment.patient_name || 'Patient'
  const rawPhone = appointment.patient_phone || ''
  const maskedPhoneNumber = maskPhone(rawPhone)
  const hasPhone = Boolean(rawPhone.trim())
  const timeStart = formatISTTimeShort(appointment.slot_start)
  const timeEnd = formatSlotEndTime(appointment.slot_start)
  const statusColor = getAppointmentStatusColor(appointment.status)
  const statusLabel = formatAppointmentStatus(appointment.status)
  const isCancelled = appointment.status === 'cancelled'
  const sourceLabel = appointment.source === 'ai' ? 'AI booked' : 'Staff'
  const formattedDoc = formatDoctorName(doctorName)

  const handleCopyPhone = async (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!rawPhone) return
    try {
      await navigator.clipboard.writeText(rawPhone)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  // Choose status icon
  const renderStatusIcon = () => {
    switch (appointment.status) {
      case 'booked':
        return <CalendarClock size={15} aria-hidden="true" />
      case 'confirmed':
        return <CalendarCheck size={15} aria-hidden="true" />
      case 'arrived':
        return <UserCheck size={15} aria-hidden="true" />
      case 'completed':
        return <CheckCircle2 size={15} aria-hidden="true" />
      case 'no_show':
        return <UserX size={15} aria-hidden="true" />
      case 'cancelled':
        return <XCircle size={15} aria-hidden="true" />
      default:
        return <CalendarClock size={15} aria-hidden="true" />
    }
  }

  return (
    <article
      className={`card booking-card-modern booking-stripe-${statusColor} ${
        isCancelled ? 'booking-card-cancelled' : ''
      }`}
    >
      {/* 
        Accessible stretched link overlay covering the card body.
        Screen readers announce the accessible description; sighted users do not see text here.
        All buttons inside the card have position:relative and z-index:2 so they remain clickable.
      */}
      <Link
        to={`/appointments/${appointment.id}`}
        className="booking-card-overlay-link"
        aria-label={`View appointment details for ${patientName} at ${timeStart}`}
      >
        <span className="visually-hidden">
          View appointment details for {patientName} at {timeStart}
        </span>
      </Link>

      {/* Main Grid: Left = Time, Middle = Patient Details, Right = Status */}
      <div className="booking-card-grid">
        {/* 1. Left Time Column */}
        <div className="booking-col-time">
          <div className="booking-time-large">{timeStart}</div>
          {timeEnd && <div className="booking-time-end">until {timeEnd}</div>}

          {isNextUp && (
            <span className="next-up-pill" role="status">
              <span className="next-up-dot" aria-hidden="true" />
              NEXT UP
            </span>
          )}

          {isPastUnfinished && (
            <div className="time-passed-hint" role="status">
              <Clock size={13} aria-hidden="true" />
              <span>Time has passed. Update status.</span>
            </div>
          )}
        </div>

        {/* 2. Middle Patient Details Column */}
        <div className="booking-col-details">
          <h3 className="booking-patient-name">{patientName}</h3>

          {hasPhone && (
            <div className="booking-phone-row">
              <span className="booking-phone-masked font-mono">{maskedPhoneNumber}</span>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="btn-phone-copy"
                title="Copy full phone number"
                aria-label="Copy phone number"
              >
                {copied ? (
                  <Check size={14} className="copy-check" aria-hidden="true" />
                ) : (
                  <Copy size={14} aria-hidden="true" />
                )}
              </button>
              <a
                href={`tel:${rawPhone}`}
                className="btn-phone-tel"
                title="Call patient"
                aria-label={`Call ${patientName}`}
              >
                <Phone size={13} aria-hidden="true" />
              </a>
            </div>
          )}

          {appointment.reason && (
            <div className="booking-reason-row">
              <span className="reason-label">Reason:</span>
              <span className="reason-text">{appointment.reason}</span>
            </div>
          )}

          <div className="booking-tags-row">
            <span className="booking-tag source-tag">
              {appointment.source === 'ai' && (
                <Sparkles size={12} className="tag-icon" aria-hidden="true" />
              )}
              {sourceLabel}
            </span>
            <span className="booking-tag doctor-tag">
              {formattedDoc}
            </span>
          </div>

          {/* Open call link on its own row under tags */}
          {appointment.call_id && (
            <div className="booking-call-link-row">
              <Link
                to={`/calls/${appointment.call_id}`}
                className="btn btn-ghost btn-open-call"
                title="Open associated call"
                aria-label="Open call details"
              >
                <ExternalLink size={14} aria-hidden="true" />
                <span>Open call</span>
              </Link>
            </div>
          )}
        </div>

        {/* 3. Right Status Badge Column */}
        <div className="booking-col-status">
          <span className={`badge status-pill status-pill-${statusColor}`}>
            {renderStatusIcon()}
            <span>{statusLabel}</span>
          </span>
        </div>
      </div>

      {/* Error Notice */}
      {saveError && (
        <div className="booking-error-banner" role="alert" aria-live="polite">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Confirmation Box (for Cancel or No-show) */}
      {isConfirming && (
        <div className="booking-confirm-panel" role="alert" aria-live="assertive">
          <div className="confirm-panel-text">
            {confirmTarget === 'cancelled' ? (
              <>
                <p className="confirm-main-prompt">
                  Cancel this booking and remove it from Google Calendar?
                </p>
                <p className="confirm-sub-prompt">
                  This action cannot be undone.
                </p>
              </>
            ) : (
              <p className="confirm-main-prompt">
                Mark this appointment as No-show?
              </p>
            )}
          </div>

          <div className="confirm-panel-actions">
            <button
              type="button"
              onClick={() => onConfirmYes(appointment, confirmTarget)}
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
                'Yes, mark no-show'
              )}
            </button>
            <button
              type="button"
              onClick={onConfirmNo}
              disabled={isSaving}
              className="btn btn-secondary btn-confirm-cancel"
            >
              {confirmTarget === 'cancelled' ? 'No, keep it' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Hairline Separator */}
      <div className="booking-card-hairline" />

      {/* 4. Action Row */}
      <div className="booking-actions-row">
        {/* Segmented status buttons */}
        <div className="segmented-status-group" role="group" aria-label="Appointment status actions">
          <button
            type="button"
            onClick={() => onStatusClick(appointment, 'arrived')}
            disabled={isSaving || appointment.status === 'arrived'}
            className={`btn btn-segment ${
              appointment.status === 'arrived' ? 'segment-active' : ''
            }`}
            aria-pressed={appointment.status === 'arrived'}
          >
            {isSaving && savingTarget === 'arrived' ? (
              <Loader2 size={15} className="spinner-inline" aria-hidden="true" />
            ) : (
              <UserCheck size={15} aria-hidden="true" />
            )}
            <span>Arrived</span>
          </button>

          <button
            type="button"
            onClick={() => onStatusClick(appointment, 'completed')}
            disabled={isSaving || appointment.status === 'completed'}
            className={`btn btn-segment ${
              appointment.status === 'completed' ? 'segment-active' : ''
            }`}
            aria-pressed={appointment.status === 'completed'}
          >
            {isSaving && savingTarget === 'completed' ? (
              <Loader2 size={15} className="spinner-inline" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={15} aria-hidden="true" />
            )}
            <span>Completed</span>
          </button>

          <button
            type="button"
            onClick={() => onStatusClick(appointment, 'no_show')}
            disabled={isSaving || appointment.status === 'no_show'}
            className={`btn btn-segment ${
              appointment.status === 'no_show' ? 'segment-active' : ''
            }`}
            aria-pressed={appointment.status === 'no_show'}
          >
            {isSaving && savingTarget === 'no_show' ? (
              <Loader2 size={15} className="spinner-inline" aria-hidden="true" />
            ) : (
              <UserX size={15} aria-hidden="true" />
            )}
            <span>No-show</span>
          </button>
        </div>

        {/* Outlined Danger Cancel button (only if not cancelled) */}
        {!isCancelled && (
          <button
            type="button"
            onClick={() => onStatusClick(appointment, 'cancelled')}
            disabled={isSaving}
            className="btn btn-outline-danger btn-cancel-booking"
            aria-label={`Cancel booking for ${patientName}`}
          >
            {isSaving && savingTarget === 'cancelled' ? (
              <Loader2 size={15} className="spinner-inline" aria-hidden="true" />
            ) : (
              <XCircle size={15} aria-hidden="true" />
            )}
            <span>Cancel booking</span>
          </button>
        )}
      </div>
    </article>
  )
}
