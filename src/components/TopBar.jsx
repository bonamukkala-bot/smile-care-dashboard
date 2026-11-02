import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Sun, Moon, LogOut, Info, CalendarOff } from 'lucide-react'
import { useTheme } from '../lib/theme'
import { formatISTDateLabel, getTodayIST } from '../lib/helpers'

export default function TopBar({
  profile,
  onLogout,
  loggingOut,
  healthData = {},
}) {
  const { theme, toggleTheme } = useTheme()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [infoTooltipOpen, setInfoTooltipOpen] = useState(false)

  const menuRef = useRef(null)
  const menuBtnRef = useRef(null)
  const infoRef = useRef(null)

  const fullName = profile?.full_name || 'Staff Member'
  const role = profile?.role || 'Staff'
  const firstLetter = (fullName.trim()[0] || 'S').toUpperCase()

  const todayIST = getTodayIST()
  const todayDateLabel = formatISTDateLabel(todayIST)

  const {
    dbConnected = true,
    lastCallRelative = 'Checking...',
    lastCallFullIST = '',
    openAttentionCount = 0,
    hasEmergency = false,
    isFirstLoad = false,
  } = healthData

  // Close menus on outside click or Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
      if (infoRef.current && !infoRef.current.contains(event.target)) {
        setInfoTooltipOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (userMenuOpen) {
          setUserMenuOpen(false)
          menuBtnRef.current?.focus()
        }
        if (infoTooltipOpen) {
          setInfoTooltipOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [userMenuOpen, infoTooltipOpen])

  return (
    <header className="app-topbar">
      {/* Left: Date */}
      <div className="topbar-left">
        <span className="topbar-date">{todayDateLabel}</span>
      </div>

      {/* Center/Right: Connection Health Pill + Tooltip */}
      <div className="topbar-center">
        <div
          className={`health-pill ${
            !dbConnected ? 'health-pill-error' : ''
          }`}
          aria-label="System status"
        >
          {/* Item 1: Database Status */}
          <div className="health-pill-segment">
            {dbConnected ? (
              <>
                <span className="health-dot health-dot-green" />
                <span className="health-pill-text">Connected</span>
              </>
            ) : (
              <>
                <span className="health-dot health-dot-red" />
                <span className="health-pill-text health-pill-text-danger">
                  Offline
                </span>
              </>
            )}
          </div>

          <span className="health-pill-divider" aria-hidden="true">•</span>

          {/* Item 2: Last Call (Neutral color) */}
          <div
            className="health-pill-segment health-segment-neutral"
            title={lastCallFullIST ? `Last call: ${lastCallFullIST}` : 'No calls received yet'}
          >
            <span className="health-pill-label">Last call:</span>
            <span className="health-pill-value">
              {isFirstLoad ? 'Checking...' : lastCallRelative}
            </span>
          </div>

          {/* Item 3: Needs Attention (if count > 0) */}
          {openAttentionCount > 0 && (
            <>
              <span className="health-pill-divider" aria-hidden="true">•</span>
              <Link
                to="/attention"
                className="health-pill-segment health-pill-link"
                title={`${openAttentionCount} item(s) need attention`}
              >
                <span
                  className={`health-dot ${
                    hasEmergency ? 'health-dot-red' : 'health-dot-amber'
                  }`}
                />
                <span className="health-pill-text">
                  Attention: <strong>{openAttentionCount}</strong>
                </span>
              </Link>
            </>
          )}

          {/* Honesty Info Popover Button */}
          <div className="health-info-wrapper" ref={infoRef}>
            <button
              type="button"
              className="btn-health-info"
              onClick={() => setInfoTooltipOpen((prev) => !prev)}
              aria-label="System visibility notice"
              aria-expanded={infoTooltipOpen}
            >
              <Info size={14} />
            </button>
            {infoTooltipOpen && (
              <div className="health-info-popover" role="tooltip">
                <p className="health-info-text">
                  Shows what the dashboard can see. It cannot check the phone line.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: User Menu with Avatar & Dropdown */}
      <div className="topbar-right" ref={menuRef}>
        <button
          ref={menuBtnRef}
          type="button"
          onClick={() => setUserMenuOpen((prev) => !prev)}
          className={`btn-user-menu ${userMenuOpen ? 'open' : ''}`}
          aria-expanded={userMenuOpen}
          aria-haspopup="true"
          aria-label="User account menu"
        >
          <div className="user-avatar" aria-hidden="true">
            {firstLetter}
          </div>
          <div className="user-text-meta">
            <span className="user-name">{fullName}</span>
            <span className="role-chip">{role}</span>
          </div>
        </button>

        {userMenuOpen && (
          <div className="user-dropdown-menu" role="menu">
            <div className="user-dropdown-header">
              <span className="dropdown-user-name">{fullName}</span>
              <span className="dropdown-user-role">{role} at Smile Care</span>
            </div>

            <div className="user-dropdown-divider" />

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => {
                toggleTheme()
              }}
              className="user-dropdown-item"
              role="menuitem"
            >
              {theme === 'dark' ? (
                <>
                  <Sun size={17} className="dropdown-icon" />
                  <span>Light theme</span>
                </>
              ) : (
                <>
                  <Moon size={17} className="dropdown-icon" />
                  <span>Dark theme</span>
                </>
              )}
            </button>

            {/* Clinic Closures Link */}
            <Link
              to="/closures"
              onClick={() => setUserMenuOpen(false)}
              className="user-dropdown-item"
              role="menuitem"
            >
              <CalendarOff size={17} className="dropdown-icon" />
              <span>Clinic closures</span>
            </Link>

            <div className="user-dropdown-divider" />

            {/* Log Out */}
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false)
                onLogout()
              }}
              disabled={loggingOut}
              className="user-dropdown-item user-dropdown-logout"
              role="menuitem"
            >
              <LogOut size={17} className="dropdown-icon" />
              <span>{loggingOut ? 'Logging out...' : 'Log out'}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
