import { useRef } from 'react'
import { Calendar, CalendarDays, List } from 'lucide-react'

const VIEWS = [
  { id: 'day', label: 'Day view', Icon: Calendar },
  { id: 'week', label: 'Week view', Icon: CalendarDays },
  { id: 'list', label: 'List view', Icon: List },
]

export default function ViewSwitcher({ viewMode, onChangeView }) {
  const tabsRef = useRef([])

  const handleKeyDown = (e, index) => {
    let nextIndex = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (index + 1) % VIEWS.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (index - 1 + VIEWS.length) % VIEWS.length
    }

    if (nextIndex !== null) {
      e.preventDefault()
      const nextView = VIEWS[nextIndex].id
      onChangeView(nextView)
      tabsRef.current[nextIndex]?.focus()
    }
  }

  return (
    <div
      className="view-switcher-bar"
      role="tablist"
      aria-label="Appointments View Selection"
    >
      {VIEWS.map(({ id, label, Icon }, index) => {
        const isSelected = viewMode === id
        return (
          <button
            key={id}
            ref={(el) => (tabsRef.current[index] = el)}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChangeView(id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`view-switcher-tab ${isSelected ? 'view-switcher-tab-active' : ''}`}
          >
            <Icon size={17} className="tab-icon" aria-hidden="true" />
            <span className="tab-label">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

