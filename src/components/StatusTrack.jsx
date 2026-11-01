import {
  CalendarClock,
  UserCheck,
  CheckCircle2,
  UserX,
  XCircle,
  Check,
} from 'lucide-react'

export default function StatusTrack({ status }) {
  if (status === 'no_show') {
    return (
      <div className="status-terminal-container" role="status" aria-label="Appointment outcome">
        <div className="terminal-chip terminal-chip-amber">
          <UserX size={16} aria-hidden="true" />
          <span>No-show (Patient did not arrive)</span>
        </div>
      </div>
    )
  }

  if (status === 'cancelled') {
    return (
      <div className="status-terminal-container" role="status" aria-label="Appointment outcome">
        <div className="terminal-chip terminal-chip-rose">
          <XCircle size={16} aria-hidden="true" />
          <span>Cancelled (Removed from schedule)</span>
        </div>
      </div>
    )
  }

  // Steps for normal flow: Booked -> Arrived -> Completed
  // Note: 'confirmed' counts as Booked
  const steps = [
    { id: 'booked', label: 'Booked', Icon: CalendarClock },
    { id: 'arrived', label: 'Arrived', Icon: UserCheck },
    { id: 'completed', label: 'Completed', Icon: CheckCircle2 },
  ]

  const getStepState = (stepId) => {
    if (status === 'completed') {
      if (stepId === 'completed') return 'current'
      return 'completed'
    }
    if (status === 'arrived') {
      if (stepId === 'booked') return 'completed'
      if (stepId === 'arrived') return 'current'
      return 'upcoming'
    }
    // booked or confirmed
    if (stepId === 'booked') return 'current'
    return 'upcoming'
  }

  return (
    <div className="status-track-container" role="region" aria-label="Appointment Progress">
      <div className="status-stepper-track">
        {steps.map((step, idx) => {
          const state = getStepState(step.id)
          const isDone = state === 'completed'
          const isCurrent = state === 'current'
          const { Icon, label } = step

          return (
            <div key={step.id} className={`stepper-node-wrapper stepper-${state}`}>
              {/* Connector line before (except first) */}
              {idx > 0 && (
                <div
                  className={`stepper-connector ${
                    isDone || isCurrent ? 'connector-done' : 'connector-pending'
                  }`}
                  aria-hidden="true"
                />
              )}

              {/* Node Circle & Label */}
              <div className="stepper-node-content">
                <div
                  className={`stepper-icon-circle ${
                    isDone ? 'circle-done' : isCurrent ? 'circle-current' : 'circle-pending'
                  }`}
                  aria-hidden="true"
                >
                  {isDone ? (
                    <Check size={14} className="node-check-icon" />
                  ) : (
                    <Icon size={14} className="node-icon" />
                  )}
                </div>
                <span className={`stepper-label ${isCurrent ? 'label-current' : ''}`}>
                  {label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

