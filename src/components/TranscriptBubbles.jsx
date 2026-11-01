import { useState } from 'react'
import { MessageSquare, Bot, User, ChevronDown, ChevronUp } from 'lucide-react'
import { formatISTTime } from '../lib/helpers'

export default function TranscriptBubbles({ turns = [] }) {
  // Desktop (>= 640px) expanded by default; mobile (< 640px) collapsed by default
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
    <section className="card detail-section-card transcript-section-card">
      <header className="transcript-section-header">
        <div className="transcript-header-title-wrap">
          <MessageSquare size={20} className="section-title-icon" aria-hidden="true" />
          <h2 className="section-title">
            Transcript
            <span className="transcript-count-badge">
              {messageCount} {messageCount === 1 ? 'message' : 'messages'}
            </span>
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="btn btn-secondary btn-toggle-transcript"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse transcript' : 'Expand transcript'}
        >
          <span>{isExpanded ? 'Hide' : 'Show'}</span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </header>

      {isExpanded && (
        <div className="transcript-body">
          {turns.length === 0 ? (
            <p className="empty-transcript-text">No transcript messages recorded for this call.</p>
          ) : (
            <div className="transcript-chat-list" role="log" aria-label="Call conversation transcript">
              {turns.map((turn, index) => {
                const timeString = formatISTTime(turn.turn_time)
                return (
                  <div key={turn.sequence || index} className="transcript-turn-block">
                    {/* Bot / Receptionist Response (Left aligned) */}
                    {turn.bot_response && (
                      <div className="chat-bubble-row bot-bubble-row">
                        <div className="chat-bubble bot-bubble">
                          <div className="bubble-header">
                            <span className="bubble-avatar bot-avatar">
                              <Bot size={14} aria-hidden="true" />
                            </span>
                            <span className="bubble-sender-name">Receptionist (AI)</span>
                            {timeString && (
                              <span className="bubble-time-mono">{timeString}</span>
                            )}
                          </div>
                          <p className="bubble-message-text">{turn.bot_response}</p>
                        </div>
                      </div>
                    )}

                    {/* Caller / User Query (Right aligned) */}
                    {turn.user_query && (
                      <div className="chat-bubble-row caller-bubble-row">
                        <div className="chat-bubble caller-bubble">
                          <div className="bubble-header caller-header">
                            {timeString && (
                              <span className="bubble-time-mono">{timeString}</span>
                            )}
                            <span className="bubble-sender-name">Caller</span>
                            <span className="bubble-avatar caller-avatar">
                              <User size={14} aria-hidden="true" />
                            </span>
                          </div>
                          <p className="bubble-message-text">{turn.user_query}</p>
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

