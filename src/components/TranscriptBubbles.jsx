import { useState } from 'react'
import { MessageSquare, Bot, User, ChevronDown, ChevronUp } from 'lucide-react'
import { formatISTTime } from '../lib/helpers'

export default function TranscriptBubbles({ turns = [] }) {
  // Desktop (>= 640px) expanded by default; phone (< 640px) collapsed by default
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 640
    }
    return true
  })

  // Count total dialog messages (queries + responses)
  const messageCount = turns.reduce((acc, t) => {
    return acc + (t.user_query ? 1 : 0) + (t.bot_response ? 1 : 0)
  }, 0)

  return (
    <section className="card call-section-card transcript-card-container" aria-label="Call transcript">
      {/* Header with Speech Bubble Icon Tile and Message Count */}
      <header className="transcript-card-header">
        <div className="transcript-header-left">
          <div className="section-icon-tile" aria-hidden="true">
            <MessageSquare size={18} />
          </div>
          <h2 className="section-card-title">
            Transcript
            <span className="transcript-count-pill">
              ({messageCount} {messageCount === 1 ? 'message' : 'messages'})
            </span>
          </h2>
        </div>

        {/* Collapsible toggle for mobile phones (and desktop toggle) */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="btn btn-secondary btn-transcript-toggle"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse transcript' : 'Expand transcript'}
        >
          <span className="toggle-label-text">{isExpanded ? 'Hide' : 'Show'}</span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </header>

      {/* Transcript Chat Body */}
      {isExpanded && (
        <div className="transcript-chat-body">
          {turns.length === 0 ? (
            <p className="empty-transcript-notice">No transcript available</p>
          ) : (
            <div className="transcript-thread" role="log" aria-label="Conversation thread">
              {turns.map((turn, index) => {
                const timeString = formatISTTime(turn.turn_time)
                return (
                  <div key={turn.sequence || index} className="transcript-turn-pair">
                    {/* 1. Agent / Receptionist Turn (LEFT) */}
                    {turn.bot_response && (
                      <div className="chat-bubble-container agent-side">
                        <div className="agent-avatar-circle" aria-hidden="true">
                          <Bot size={15} />
                        </div>
                        <div className="bubble-and-meta agent-bubble-and-meta">
                          <span className="bubble-speaker-label">Receptionist (AI)</span>
                          <div className="chat-bubble agent-chat-bubble">
                            <p className="bubble-body-text">{turn.bot_response}</p>
                          </div>
                          {timeString && (
                            <span className="bubble-timestamp-under font-mono">
                              {timeString}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 2. Caller Turn (RIGHT) */}
                    {turn.user_query && (
                      <div className="chat-bubble-container caller-side">
                        <div className="bubble-and-meta caller-bubble-and-meta">
                          <span className="bubble-speaker-label caller-label">Caller</span>
                          <div className="chat-bubble caller-chat-bubble">
                            <p className="bubble-body-text">{turn.user_query}</p>
                          </div>
                          {timeString && (
                            <span className="bubble-timestamp-under caller-time font-mono">
                              {timeString}
                            </span>
                          )}
                        </div>
                        <div className="caller-avatar-circle" aria-hidden="true">
                          <User size={15} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
