import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  formatIST,
  formatISTTime,
  formatDuration,
  getPatientNumber,
  getOutcome,
  formatVariableValue,
  formatAttentionType,
} from '../lib/helpers'

export default function CallDetail() {
  const { callId } = useParams()
  const [call, setCall] = useState(null)
  const [turns, setTurns] = useState([])
  const [attentionItems, setAttentionItems] = useState([])
  const [appointment, setAppointment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadCallDetails() {
      if (!callId) return
      setLoading(true)
      setError(null)

      try {
        // Fetch call (WITHOUT raw_payload), turns, attention items, appointment in parallel
        const [callRes, turnsRes, attentionRes, appointmentRes] = await Promise.all([
          supabase
            .from('calls')
            .select(
              'call_id, direction, from_number, to_number, patient_number, started_at, duration_seconds, status, hangup_source, hangup_reason, recording_url, summary, sentiment, variables, received_at'
            )
            .eq('call_id', callId)
            .maybeSingle(),
          supabase
            .from('call_turns')
            .select('call_id, sequence, user_query, bot_response, turn_time')
            .eq('call_id', callId)
            .order('sequence', { ascending: true }),
          supabase
            .from('attention_items')
            .select('call_id, type, status')
            .eq('call_id', callId),
          supabase
            .from('appointments')
            .select('call_id, patient_name, slot_start, status')
            .eq('call_id', callId)
            .maybeSingle(),
        ])

        if (!isMounted) return

        if (callRes.error) throw callRes.error
        if (turnsRes.error) throw turnsRes.error
        if (attentionRes.error) throw attentionRes.error
        if (appointmentRes.error) throw appointmentRes.error

        if (!callRes.data) {
          setError('Call not found.')
          return
        }

        setCall(callRes.data)
        setTurns(turnsRes.data || [])
        setAttentionItems(attentionRes.data || [])
        setAppointment(appointmentRes.data || null)
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to load call detail:', err.message || err)
        setError('Unable to load call details. Please try again.')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadCallDetails()

    return () => {
      isMounted = false
    }
  }, [callId])

  if (loading) {
    return (
      <div className="page-container">
        <header className="page-header">
          <Link to="/calls" className="btn btn-back">
            ← Back
          </Link>
        </header>
        <div className="loading-card">
          <div className="spinner" aria-hidden="true" />
          <p className="loading-text">Loading call details...</p>
        </div>
      </div>
    )
  }

  if (error || !call) {
    return (
      <div className="page-container">
        <header className="page-header">
          <Link to="/calls" className="btn btn-back">
            ← Back
          </Link>
        </header>
        <div className="card error-card">
          <p className="error-text">{error || 'Call not found.'}</p>
          <Link to="/calls" className="btn btn-primary">
            Return to Call Log
          </Link>
        </div>
      </div>
    )
  }

  const patientNumber = getPatientNumber(call)
  const callerName = call.variables?.full_name
    ? String(call.variables.full_name)
    : 'Unknown caller'
  const outcome = getOutcome(call, appointment, attentionItems)
  const openAttentionItems = attentionItems.filter((item) => item.status === 'open')
  const variables = call.variables || {}

  return (
    <div className="page-container">
      <header className="page-header">
        <Link to="/calls" className="btn btn-back">
          ← Back
        </Link>
      </header>

      {/* Top Details Card */}
      <section className="card call-top-card">
        <div className="top-header-row">
          <div>
            <h1 className="detail-caller-name">{callerName}</h1>
            <div className="phone-row">
              {patientNumber !== '-' ? (
                <a
                  href={`tel:${patientNumber}`}
                  className="tel-link"
                  title="Tap to call back"
                >
                  📞 {patientNumber}
                </a>
              ) : (
                <span className="tel-link-disabled">No phone number</span>
              )}
            </div>
          </div>
          <span className={`badge outcome-badge outcome-${outcome.color}`}>
            {outcome.label}
          </span>
        </div>

        <div className="detail-meta-grid">
          <div className="meta-box">
            <span className="meta-label">Date & Time</span>
            <span className="meta-value">{formatIST(call.started_at)}</span>
          </div>
          <div className="meta-box">
            <span className="meta-label">Duration</span>
            <span className="meta-value">{formatDuration(call.duration_seconds)}</span>
          </div>
          <div className="meta-box">
            <span className="meta-label">Language</span>
            <span className="meta-value">
              {formatVariableValue(variables.call_language)}
            </span>
          </div>
          <div className="meta-box">
            <span className="meta-label">Direction</span>
            <span className="meta-value capitalize">
              {call.direction || 'Inbound'}
            </span>
          </div>
        </div>

        {/* Red Needs attention box for open attention items */}
        {openAttentionItems.length > 0 && (
          <div className="attention-alert-box" role="alert">
            <div className="attention-alert-header">
              <span className="attention-alert-title">⚠️ Needs attention</span>
            </div>
            <ul className="attention-item-list">
              {openAttentionItems.map((item, idx) => (
                <li key={idx} className="attention-item-name">
                  {formatAttentionType(item.type)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Summary Card */}
      <section className="card detail-section-card">
        <h2 className="section-title">Summary</h2>
        <p className="summary-text">
          {call.summary && call.summary.trim() !== ''
            ? call.summary
            : 'No summary available for this call.'}
        </p>
      </section>

      {/* Extracted Details Card */}
      <section className="card detail-section-card">
        <h2 className="section-title">Extracted Details</h2>
        <div className="extracted-grid">
          <div className="extracted-row">
            <span className="extracted-label">Name</span>
            <span className="extracted-value">
              {formatVariableValue(variables.full_name)}
            </span>
          </div>
          <div className="extracted-row">
            <span className="extracted-label">New or existing patient</span>
            <span className="extracted-value">
              {formatVariableValue(variables.patient_status)}
            </span>
          </div>
          <div className="extracted-row">
            <span className="extracted-label">Reason for visit</span>
            <span className="extracted-value">
              {formatVariableValue(variables.reason_for_visit)}
            </span>
          </div>
          <div className="extracted-row">
            <span className="extracted-label">Preferred time</span>
            <span className="extracted-value">
              {formatVariableValue(variables.preferred_date_time)}
            </span>
          </div>
          <div className="extracted-row">
            <span className="extracted-label">Appointment action</span>
            <span className="extracted-value">
              {formatVariableValue(variables.appointment_action)}
            </span>
          </div>
          <div className="extracted-row">
            <span className="extracted-label">Confirmed slot</span>
            <span className="extracted-value">
              {formatVariableValue(variables.confirmed_slot)}
            </span>
          </div>
          <div className="extracted-row">
            <span className="extracted-label">Language</span>
            <span className="extracted-value">
              {formatVariableValue(variables.call_language)}
            </span>
          </div>
          <div className="extracted-row">
            <span className="extracted-label">Emergency</span>
            <span className="extracted-value">
              {formatVariableValue(variables.emergency_flag)}
            </span>
          </div>

          {appointment && (
            <div className="extracted-row appointment-extracted-row">
              <span className="extracted-label">Appointment</span>
              <span className="extracted-value appointment-highlight">
                Booked for {formatIST(appointment.slot_start)} ({appointment.status})
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Recording Card */}
      <section className="card detail-section-card">
        <h2 className="section-title">Recording</h2>
        {call.recording_url ? (
          <div className="audio-player-wrapper">
            <audio
              controls
              preload="none"
              src={call.recording_url}
              className="audio-player"
            >
              Your browser does not support audio playback.
            </audio>
          </div>
        ) : (
          <p className="no-recording-text">No recording</p>
        )}
      </section>

      {/* Transcript Card */}
      <section className="card detail-section-card">
        <h2 className="section-title">Transcript</h2>
        {turns.length === 0 ? (
          <p className="empty-transcript-text">No transcript turns available.</p>
        ) : (
          <div className="transcript-list">
            {turns.map((turn, index) => {
              const timeString = formatISTTime(turn.turn_time)
              return (
                <div key={turn.sequence || index} className="turn-pair">
                  {turn.user_query && (
                    <div className="chat-bubble-container caller-side">
                      <div className="chat-bubble caller-bubble">
                        <span className="bubble-sender">Caller</span>
                        <p className="bubble-text">{turn.user_query}</p>
                        {timeString && (
                          <span className="bubble-timestamp">{timeString}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {turn.bot_response && (
                    <div className="chat-bubble-container bot-side">
                      <div className="chat-bubble bot-bubble">
                        <span className="bubble-sender">Receptionist (AI)</span>
                        <p className="bubble-text">{turn.bot_response}</p>
                        {timeString && (
                          <span className="bubble-timestamp">{timeString}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

