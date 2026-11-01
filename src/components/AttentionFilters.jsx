import { Search } from 'lucide-react'
import { formatTimeAgo } from '../lib/helpers'

const TYPE_CONFIG = {
  emergency: 'Emergency',
  hung_up_midway: 'Caller hung up',
  booking_unconfirmed: 'Booking not confirmed',
  call_failed: 'Call failed',
  other: 'Other',
}

export default function AttentionFilters({
  totalOpenCount,
  typeCounts,
  activeFilter,
  onSelectFilter,
  searchQuery,
  onSearchChange,
  lastRefreshedAt,
}) {
  const updatedAgo = lastRefreshedAt ? formatTimeAgo(lastRefreshedAt) : 'just now'

  // Only show chips for types that currently have at least one open item
  const availableTypes = Object.keys(TYPE_CONFIG).filter(
    (type) => (typeCounts[type] || 0) > 0
  )

  return (
    <div className="attention-controls-wrapper">
      {/* Search and Status row */}
      <div className="attention-top-controls">
        <div className="attention-search-box">
          <Search size={18} className="search-icon" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name, phone or summary"
            className="attention-search-input"
            aria-label="Search open attention items by name, phone or summary"
          />
        </div>

        <div className="attention-refresh-status" aria-label="Auto refresh status">
          <span className="live-status-dot" aria-hidden="true" />
          <span className="status-text">
            Auto-refreshes every minute • Updated {updatedAgo}
          </span>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div
        className="filter-chips-scroll"
        role="tablist"
        aria-label="Filter attention items by type"
      >
        {/* All Chip */}
        <button
          type="button"
          role="tab"
          aria-selected={activeFilter === 'all'}
          onClick={() => onSelectFilter('all')}
          className={`filter-chip ${activeFilter === 'all' ? 'filter-chip-active' : ''}`}
        >
          All ({totalOpenCount})
        </button>

        {/* Dynamic Type Chips */}
        {availableTypes.map((typeKey) => {
          const count = typeCounts[typeKey] || 0
          const label = TYPE_CONFIG[typeKey]
          const isSelected = activeFilter === typeKey

          return (
            <button
              key={typeKey}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelectFilter(typeKey)}
              className={`filter-chip ${
                isSelected ? 'filter-chip-active' : ''
              } ${typeKey === 'emergency' ? 'chip-emergency' : ''}`}
            >
              {label} ({count})
            </button>
          )
        })}
      </div>
    </div>
  )
}

