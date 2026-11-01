import { Link } from 'react-router-dom'
import { Check, Flag, Clock, Globe, Activity } from 'lucide-react'
import {
  formatIST,
  formatDuration,
  getPatientNumber,
  maskPhone,
  getOutcome,
  hasOpenAttention,
  formatVariableValue,
  formatSlotRange,
} from '../lib/helpers'

export default function CallCard({ call }) {
  const fullPhone = getPatientNumber(call)
  const maskedNumber = maskPhone(fullPhone)
  const callerName = call.variables?.full_name
    ? String(call.variables.full_name)
    : 'Unknown caller'
  const formattedTime = formatIST(call.started_at)
  const durationText = formatDuration(call.duration_seconds)
  const languageText = formatVariableValue(call.variables?.call_language)
  const outcome = getOutcome(call, call.appointment, call.attentionItems)
  const hasFlag = hasOpenAttention(call.attentionItems)

  // Outcome detail label for stats row
  let outcomeDetail = outcome.label
  if (call.appointment?.slot_start) {
    outcomeDetail = `Booked (${formatSlotRange(call.appointment.slot_start)})`
  } else if (call.variables?.appointment_action && call.variables.appointment_action !== '-') {
    outcomeDetail = String(call.variables.appointment_action)
  } else if (call.hangup_source === 'user') {
    outcomeDetail = 'Caller hung up'
  } else if (call.status && call.status !== 'completed') {
    outcomeDetail = `Failed (${call.status})`
  }

  return (
    <article
      className={`card call-card-modern outcome-stripe-${outcome.color}`}
      aria-label={`Call from ${callerName} on ${formattedTime}`}
    >
      {/* Accessible stretched link overlay */}
      <Link
        to={`/calls/${call.call_id}`}
        state={{ fromCallLog: true }}
        className="call-card-overlay-link"
        aria-label={`View call details for ${callerName} on ${formattedTime}`}
      >
        <span className="visually-hidden">
          View call details for {callerName} on {formattedTime}
        </span>
      </Link>

      {/* Top row: Datetime, Caller & Masked Phone, Badges */}
      <div className="call-card-header">
        <div className="call-card-meta-left">
          <span className="call-datetime-mono">{formattedTime}</span>
          <div className="call-caller-row">
            <h3 className="call-card-caller-name">{callerName}</h3>
            <span className="call-phone-mono">{maskedNumber}</span>
          </div>
        </div>

        <div className="call-card-badges-row">
          <span
            className={`badge outcome-badge outcome-${outcome.color}`}
            title={`Outcome: ${outcome.label}`}
          >
            {outcome.label}
          </span>
          {call.isReviewed && (
            <span
              className="badge review-badge-success"
              title="This call has been reviewed"
            >
              <Check size={13} className="badge-check-icon" aria-hidden="true" />
              <span>Reviewed</span>
            </span>
          )}
          {hasFlag && (
            <span
              className="badge flag-badge-danger"
              title="This call has an open attention item"
            >
              <Flag size={13} className="badge-flag-icon" aria-hidden="true" />
              <span>Needs attention</span>
            </span>
          )}
        </div>
      </div>

      {/* Hairline Divider with labelled stats: DURATION, LANGUAGE, OUTCOME DETAIL */}
      <div className="call-card-stats-divider">
        <div className="call-stat-col">
          <span className="call-stat-label">
            <Clock size={12} aria-hidden="true" />
            <span>Duration</span>
          </span>
          <span className="call-stat-value">{durationText}</span>
        </div>

        <div className="call-stat-col">
          <span className="call-stat-label">
            <Globe size={12} aria-hidden="true" />
            <span>Language</span>
          </span>
          <span className="call-stat-value">{languageText}</span>
        </div>

        <div className="call-stat-col call-stat-col-detail">
          <span className="call-stat-label">
            <Activity size={12} aria-hidden="true" />
            <span>Outcome Detail</span>
          </span>
          <span className="call-stat-value call-stat-outcome-detail" title={outcomeDetail}>
            {outcomeDetail}
          </span>
        </div>
      </div>
    </article>
  )
}

