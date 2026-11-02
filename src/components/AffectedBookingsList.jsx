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
    <div className="affected-bookings-table" role="region" aria-label="Bookings requiring attention">
      <div className="affected-bookings-header">
        <span className="affected-col-patient">Patient</span>
        <span className="affected-col-time">Date &amp; Time (IST)</span>
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
              {/* Patient info with Telugu script support */}
              <div className="affected-cell-patient">
                <strong className="affected-patient-name">{booking.patient_name || 'Patient'}</strong>
                {rawPhone && (
                  <div className="affected-phone-row">
                    <span className="affected-phone-text">{maskedPhoneStr}</span>
                    <a
                      href={`tel:${rawPhone}`}
                      className="affected-call-btn"
                      aria-label={`Call ${booking.patient_name || 'patient'} at ${maskedPhoneStr}`}
                    >
                      <Phone size={13} aria-hidden="true" />
                      <span>Call</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Slot time */}
              <div className="affected-cell-time">
                <span className="affected-date-text">{dateLabel}</span>
                <span className="affected-time-range">{slotRange}</span>
              </div>

              {/* Status badge */}
              <div className="affected-cell-status">
                <span className={`status-badge status-badge-${statusColor}`}>
                  {statusLabel}
                </span>
              </div>

              {/* Action */}
              <div className="affected-cell-actions">
                <Link
                  to={`/appointments/${booking.id}`}
                  className="btn btn-secondary btn-sm affected-open-btn"
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
  )
}

