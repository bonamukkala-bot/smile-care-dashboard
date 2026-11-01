import { Link } from 'react-router-dom'
import { Layers, AlertTriangle, CalendarCheck, ExternalLink } from 'lucide-react'
import {
  formatVariableValue,
  formatPlainISTDateTime,
  formatIST,
} from '../lib/helpers'

export default function ExtractedDetails({ variables = {}, appointment = null }) {
  // Check if emergency flag indicates emergency
  const emergencyRaw = variables?.emergency_flag
  const isEmergency = Boolean(
    emergencyRaw === true ||
    (typeof emergencyRaw === 'string' &&
      ['true', 'yes', 'emergency'].includes(emergencyRaw.toLowerCase().trim()))
  )

  const formattedPreferredTime = formatPlainISTDateTime(variables?.preferred_date_time)
  const formattedConfirmedSlot = formatPlainISTDateTime(variables?.confirmed_slot)

  return (
    <section className="card call-section-card extracted-details-card" aria-label="Extracted details">
      {/* Card Header with Icon Tile */}
      <div className="card-section-header">
        <div className="section-icon-tile" aria-hidden="true">
          <Layers size={18} />
        </div>
        <h2 className="section-card-title">Extracted Details</h2>
      </div>

      {/* Grid of Labelled Tiles */}
      <div className="extracted-fields-grid">
        {/* 1. Name */}
        <div className="extracted-tile">
          <span className="extracted-tile-label">Name</span>
          <span className="extracted-tile-value">
            {formatVariableValue(variables?.full_name)}
          </span>
        </div>

        {/* 2. New or Existing Patient */}
        <div className="extracted-tile">
          <span className="extracted-tile-label">New or Existing Patient</span>
          <span className="extracted-tile-value">
            {formatVariableValue(variables?.patient_status)}
          </span>
        </div>

        {/* 3. Reason for Visit */}
        <div className="extracted-tile">
          <span className="extracted-tile-label">Reason for Visit</span>
          <span className="extracted-tile-value">
            {formatVariableValue(variables?.reason_for_visit)}
          </span>
        </div>

        {/* 4. Preferred Time */}
        <div className="extracted-tile">
          <span className="extracted-tile-label">Preferred Time</span>
          <span className="extracted-tile-value font-mono">
            {formattedPreferredTime}
          </span>
        </div>

        {/* 5. Appointment Action */}
        <div className="extracted-tile">
          <span className="extracted-tile-label">Appointment Action</span>
          <span className="extracted-tile-value">
            {formatVariableValue(variables?.appointment_action)}
          </span>
        </div>

        {/* 6. Confirmed Slot */}
        <div className="extracted-tile">
          <span className="extracted-tile-label">Confirmed Slot</span>
          <span className="extracted-tile-value font-mono">
            {formattedConfirmedSlot}
          </span>
        </div>

        {/* 7. Language */}
        <div className="extracted-tile">
          <span className="extracted-tile-label">Language</span>
          <span className="extracted-tile-value">
            {formatVariableValue(variables?.call_language)}
          </span>
        </div>

        {/* 8. Emergency */}
        <div className="extracted-tile">
          <span className="extracted-tile-label">Emergency</span>
          <span className="extracted-tile-value">
            {isEmergency ? (
              <span className="badge badge-emergency-alert" role="alert">
                <AlertTriangle size={13} aria-hidden="true" />
                <span>Emergency</span>
              </span>
            ) : (
              '-'
            )}
          </span>
        </div>
      </div>

      {/* Linked Booking Strip (only if appointment exists) */}
      {appointment && (
        <div className="linked-appointment-strip-container">
          <Link
            to={`/appointments/${appointment.id}`}
            className="linked-appointment-strip"
            aria-label={`View appointment details for ${appointment.patient_name || 'patient'}`}
          >
            <div className="strip-left-icon" aria-hidden="true">
              <CalendarCheck size={20} />
            </div>
            <div className="strip-content">
              <span className="strip-small-label">Appointment</span>
              <strong className="strip-title-text font-mono">
                Booked for {formatIST(appointment.slot_start)} ({appointment.status || 'booked'})
              </strong>
            </div>
            <div className="strip-arrow" aria-hidden="true">
              <ExternalLink size={16} />
            </div>
          </Link>
        </div>
      )}
    </section>
  )
}

