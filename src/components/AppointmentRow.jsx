import { Link } from 'react-router-dom'
import {
  CalendarClock,
  CalendarCheck,
  UserCheck,
  CheckCircle2,
  UserX,
  XCircle,
  Sparkles,
} from 'lucide-react'
import {
  formatSlotRange,
  formatAppointmentStatus,
  getAppointmentStatusColor,
  formatDoctorName,
} from '../lib/helpers'

export default function AppointmentRow({ appointment, doctorName }) {
  const timeRange = formatSlotRange(appointment.slot_start)
  const patientName = appointment.patient_name || 'Patient'
  const statusColor = getAppointmentStatusColor(appointment.status)
  const statusLabel = formatAppointmentStatus(appointment.status)
  const isCancelled = appointment.status === 'cancelled'
  const sourceLabel = appointment.source === 'ai' ? 'AI' : 'Staff'
  const formattedDoctor = formatDoctorName(doctorName)

  const renderStatusIcon = (status) => {
    switch (status) {
      case 'booked':
        return <CalendarClock size={13} aria-hidden="true" />
      case 'confirmed':
        return <CalendarCheck size={13} aria-hidden="true" />
      case 'arrived':
        return <UserCheck size={13} aria-hidden="true" />
      case 'completed':
        return <CheckCircle2 size={13} aria-hidden="true" />
      case 'no_show':
        return <UserX size={13} aria-hidden="true" />
      case 'cancelled':
        return <XCircle size={13} aria-hidden="true" />
      default:
        return <CalendarClock size={13} aria-hidden="true" />
    }
  }

  return (
    <article
      className={`card appt-list-row appt-row-stripe-${statusColor} ${
        isCancelled ? 'appt-row-cancelled' : ''
      }`}
    >
      <Link
        to={`/appointments/${appointment.id}`}
        className="appt-row-overlay-link"
        aria-label={`View appointment details for ${patientName} at ${timeRange}`}
      >
        <span className="visually-hidden">
          View appointment details for {patientName} at {timeRange}
        </span>
      </Link>

      <div className="appt-row-time-col">
        <span className="appt-row-time-text">{timeRange}</span>
        <span className="appt-row-source-badge">
          {appointment.source === 'ai' && (
            <Sparkles size={11} className="source-sparkle" aria-hidden="true" />
          )}
          {sourceLabel}
        </span>
      </div>

      <div className="appt-row-main-col">
        <h4 className="appt-row-patient-name">{patientName}</h4>
        {appointment.reason && (
          <p className="appt-row-reason" title={appointment.reason}>
            {appointment.reason}
          </p>
        )}
      </div>

      <div className="appt-row-doctor-col">
        <span className="appt-row-doctor-text">{formattedDoctor}</span>
      </div>

      <div className="appt-row-status-col">
        <span className={`badge status-pill status-pill-${statusColor}`}>
          {renderStatusIcon(appointment.status)}
          <span>{statusLabel}</span>
        </span>
      </div>
    </article>
  )
}

