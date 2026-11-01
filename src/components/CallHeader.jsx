import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Phone,
  Copy,
  Check,
  Calendar,
  Clock,
  Globe,
  PhoneIncoming,
  PhoneOutgoing,
} from 'lucide-react'
import {
  formatIST,
  formatDuration,
  formatVariableValue,
  getAvatarFirstChar,
} from '../lib/helpers'

export default function CallHeader({
  call,
  patientNumber,
  callerName,
  outcome,
  isReviewed,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [copied, setCopied] = useState(false)

  const handleBack = () => {
    if (
      location.state?.fromCallLog ||
      (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0)
    ) {
      navigate(-1)
    } else {
      navigate('/calls')
    }
  }

  const handleCopyPhone = async () => {
    if (!patientNumber || patientNumber === '-') return
    try {
      await navigator.clipboard.writeText(patientNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const avatarChar = getAvatarFirstChar(callerName)
  const hasPhone = Boolean(patientNumber && patientNumber !== '-')
  const directionStr = call.direction
    ? call.direction.charAt(0).toUpperCase() + call.direction.slice(1).toLowerCase()
    : 'Inbound'
  const isOutbound = directionStr.toLowerCase() === 'outbound'
  const DirectionIcon = isOutbound ? PhoneOutgoing : PhoneIncoming

  return (
    <div className="call-header-container">
      {/* 1. Top Back Button */}
      <div className="call-top-back-row">
        <button
          type="button"
          onClick={handleBack}
          className="btn btn-secondary btn-call-back"
          aria-label="Back to call log"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Back</span>
        </button>
      </div>

      {/* 2. Header Card */}
      <section className="card call-header-hero-card" aria-label="Call summary header">
        <div className="call-hero-top-row">
          {/* Left Avatar & Caller Information */}
          <div className="call-hero-left-profile">
            <div className="caller-round-avatar" aria-hidden="true">
              {avatarChar ? (
                <span className="caller-avatar-char">{avatarChar}</span>
              ) : (
                <Phone size={24} className="caller-avatar-fallback-icon" />
              )}
            </div>

            <div className="caller-identity-column">
              <h1 className="caller-display-name">{callerName}</h1>

              {hasPhone && (
                <div className="caller-phone-pill-row">
                  <div className="phone-icon-tile" aria-hidden="true">
                    <Phone size={14} />
                  </div>
                  <a
                    href={`tel:${patientNumber}`}
                    className="caller-tel-link"
                    title="Tap to call"
                  >
                    {patientNumber}
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyPhone}
                    className="btn-copy-phone-icon"
                    aria-label="Copy phone number"
                    title={copied ? 'Copied' : 'Copy phone number'}
                  >
                    {copied ? (
                      <span className="copied-pill-text">Copied</span>
                    ) : (
                      <Copy size={13} aria-hidden="true" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Top Right Badges */}
          <div className="call-hero-top-badges">
            <span className={`badge outcome-badge outcome-${outcome.color}`}>
              <span className="outcome-dot" aria-hidden="true" />
              <span>{outcome.label}</span>
            </span>

            {isReviewed && (
              <span className="badge badge-reviewed" title="This call has been reviewed">
                <Check size={14} aria-hidden="true" />
                <span>Reviewed</span>
              </span>
            )}
          </div>
        </div>

        {/* 4 Info Tiles Below (2x2 on phone) */}
        <div className="call-hero-info-tiles-grid">
          {/* Tile 1: Date & Time */}
          <div className="call-info-tile">
            <div className="info-tile-icon-wrap" aria-hidden="true">
              <Calendar size={16} />
            </div>
            <div className="info-tile-meta">
              <span className="info-tile-label">Date & Time</span>
              <strong className="info-tile-value font-mono">
                {formatIST(call.started_at)}
              </strong>
            </div>
          </div>

          {/* Tile 2: Duration */}
          <div className="call-info-tile">
            <div className="info-tile-icon-wrap" aria-hidden="true">
              <Clock size={16} />
            </div>
            <div className="info-tile-meta">
              <span className="info-tile-label">Duration</span>
              <strong className="info-tile-value">
                {formatDuration(call.duration_seconds)}
              </strong>
            </div>
          </div>

          {/* Tile 3: Language */}
          <div className="call-info-tile">
            <div className="info-tile-icon-wrap" aria-hidden="true">
              <Globe size={16} />
            </div>
            <div className="info-tile-meta">
              <span className="info-tile-label">Language</span>
              <strong className="info-tile-value">
                {formatVariableValue(call.variables?.call_language)}
              </strong>
            </div>
          </div>

          {/* Tile 4: Direction */}
          <div className="call-info-tile">
            <div className="info-tile-icon-wrap" aria-hidden="true">
              <DirectionIcon size={16} />
            </div>
            <div className="info-tile-meta">
              <span className="info-tile-label">Direction</span>
              <strong className="info-tile-value">{directionStr}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

