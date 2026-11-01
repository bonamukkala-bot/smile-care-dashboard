import { useRef } from 'react'
import { Mic, Lock, MicOff } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function RecordingCard({ recordingUrl, callId, userId }) {
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
    <section className="card call-section-card recording-card-container" aria-label="Call recording">
      <div className="card-section-header">
        <div className="section-icon-tile" aria-hidden="true">
          <Mic size={18} />
        </div>
        <h2 className="section-card-title">Recording</h2>
      </div>

      {recordingUrl ? (
        <div className="audio-player-wrapper">
          <audio
            controls
            preload="none"
            src={recordingUrl}
            onPlay={handleAudioPlay}
            className="native-audio-controls"
            aria-label="Call audio recording playback"
          >
            Your browser does not support audio playback.
          </audio>
          <div className="recording-privacy-note">
            <Lock size={14} className="privacy-lock-icon" aria-hidden="true" />
            <span>Recordings are for staff only.</span>
          </div>
        </div>
      ) : (
        <div className="empty-recording-box">
          <MicOff size={18} className="empty-recording-icon" aria-hidden="true" />
          <p className="empty-recording-message">No recording available</p>
        </div>
      )}
    </section>
  )
}

