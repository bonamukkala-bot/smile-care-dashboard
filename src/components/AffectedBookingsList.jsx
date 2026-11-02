import { Link } from 'react-router-dom'
import { Phone, ExternalLink, CheckCircle2 } from 'lucide-react'
import {
  formatSlotRange,
  maskPhone,
  formatAppointmentStatus,
  getAppointmentStatusColor,
  getISTDateKey,
  formatISTDateLabel,
} from '../lib/helpers'

/**
 * List of bookings falling inside a closure window.
 * Shows patient name, time, phone call button, and link to open appointment.
 */
export default function AffectedBookingsList({ bookings = [], loading = false }) {
  if (loading) {
    return (
      <div className="affected-bookings-loading" aria-busy="true">
        <div className="skeleton-line" style={{ width: '60%', height: '18px' }} />
        <div className="skeleton-line" style={{ width: '80%', height: '18px', marginTop: '8px' }} />
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <div className="affected-bookings-empty" role="status">
        <CheckCircle2 size={18} className="affected-all-handled-icon" aria-hidden="true" />
        <span>All bookings handled</span>
      </div>
    )
  }

  return (
    <div className="affected-bookings-section" role="region" aria-label="Bookings requiring attention">
      <p className="affected-bookings-intro-msg">
        Call each patient, then move or cancel the booking.
      </p>

      <div className="affected-bookings-table">
        <div className="affected-bookings-header">
          <span className="affected-col-time">Time &amp; Date (IST)</span>
          <span className="affected-col-patient">Patient</span>
          <span className="affected-col-status">Status</span>
          <span className="affected-col-actions">Actions</span>
        </div>

        <div className="affected-bookings-body">
          {bookings.map((booking) => {
            const dateKey = getISTDateKey(booking.slot_start)
            const dateLabel = formatISTDateLabel(dateKey)
            const slotRange = formatSlotRange(booking.slot_start)
            const statusColor = getAppointmentStatusColor(booking.status)
            const statusLabel = formatAppointmentStatus(booking.status)
            const rawPhone = booking.patient_phone ? String(booking.patient_phone).trim() : ''
            const maskedPhoneStr = maskPhone(booking.patient_phone)

            return (
              <div key={booking.id} className="affected-booking-row">
                {/* 1. Time first (large) */}
                <div className="affected-cell-time">
                  <strong className="affected-time-range">{slotRange}</strong>
                  <span className="affected-date-text">{dateLabel}</span>
                </div>

                {/* 2. Patient name (Telugu script safe) + masked phone */}
                <div className="affected-cell-patient">
                  <span className="affected-patient-name">{booking.patient_name || 'Patient'}</span>
                  {rawPhone && (
                    <span className="affected-phone-text">{maskedPhoneStr}</span>
                  )}
                </div>

                {/* 3. Status badge */}
                <div className="affected-cell-status">
                  <span className={`status-badge status-badge-${statusColor}`}>
                    {statusLabel}
                  </span>
                </div>

                {/* 4. Action buttons: 48px call button + Open link */}
                <div className="affected-cell-actions">
                  {rawPhone && (
                    <a
                      href={`tel:${rawPhone}`}
                      className="btn btn-secondary affected-call-btn"
                      aria-label={`Call ${booking.patient_name || 'patient'} at ${maskedPhoneStr}`}
                    >
                      <Phone size={15} aria-hidden="true" />
                      <span>Call</span>
                    </a>
                  )}

                  <Link
                    to={`/appointments/${booking.id}`}
                    className="btn btn-secondary affected-open-btn"
                    aria-label={`Open booking for ${booking.patient_name || 'patient'}`}
                  >
                    <span>Open booking</span>
                    <ExternalLink size={14} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
