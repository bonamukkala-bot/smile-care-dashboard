import { useRef } from 'react'
import { Volume2, Lock, VolumeX } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function RecordingPlayer({ recordingUrl, callId, userId }) {
  const hasAuditedPlayRef = useRef(false)

  const handleAudioPlay = () => {
    if (hasAuditedPlayRef.current || !userId || !callId) return
    hasAuditedPlayRef.current = true

    // Insert play_recording into audit_log; silently ignore any error; NEVER use .select()
    supabase
      .from('audit_log')
      .insert({
        action: 'play_recording',
        call_id: Number(callId),
        user_id: userId,
        details: 'Played recording audio',
      })
      .then(() => {})
      .catch(() => {})
  }

  return (
    <section className="card detail-section-card recording-section-card">
      <div className="section-title-wrap">
        <Volume2 size={20} className="section-title-icon" aria-hidden="true" />
        <h2 className="section-title">Call Recording</h2>
      </div>

      {recordingUrl ? (
        <div className="audio-player-container">
          <audio
            controls
            preload="none"
            src={recordingUrl}
            onPlay={handleAudioPlay}
            className="audio-player-element"
            aria-label="Call audio recording"
          >
            Your browser does not support audio playback.
          </audio>
          <div className="audio-security-note">
            <Lock size={14} className="security-icon" aria-hidden="true" />
            <span>Recordings are for staff quality and training only.</span>
          </div>
        </div>
      ) : (
        <div className="empty-recording-state">
          <VolumeX size={20} className="empty-icon-muted" aria-hidden="true" />
          <p className="no-recording-text">No recording available for this call.</p>
        </div>
      )}
    </section>
  )
}

