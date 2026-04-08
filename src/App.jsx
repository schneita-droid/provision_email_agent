import React, { useState, useEffect } from 'react'
import SummaryCards from './components/SummaryCards'
import CategoryFilter from './components/CategoryFilter'
import EmailList from './components/EmailList'
import StyleSettings from './components/StyleSettings'
import { categorizeEmails } from './lib/categorize'
import { getDemoEmails, fetchEmails, initGoogleAuth, signIn, isAuthenticated, loadScheduledReplies, trashEmail, toggleReadStatus } from './lib/gmail'

const CORRECTIONS_KEY = 'prioritized_corrections'

function loadCorrections() {
  try {
    return JSON.parse(localStorage.getItem(CORRECTIONS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveCorrection(corrections) {
  localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(corrections))
}

export default function App() {
  const [emails, setEmails] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('demo') // 'demo' | 'live'
  const [error, setError] = useState(null)
  const [corrections, setCorrections] = useState(loadCorrections)
  const [showStyleSettings, setShowStyleSettings] = useState(false)

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    loadEmails()
    loadScheduledReplies()
  }, [])

  async function loadEmails(silent = false) {
    if (!silent) setLoading(true)
    setError(null)
    try {
      let raw
      if (mode === 'live' && isAuthenticated()) {
        raw = await fetchEmails(20)
      } else {
        raw = getDemoEmails()
      }

      // Smart categorization: only categorize new emails
      const existingIds = new Set(emails.map(e => e.id))
      const newEmails = raw.filter(e => !existingIds.has(e.id))
      const existingEmails = raw.filter(e => existingIds.has(e.id))

      // Keep existing categories for already-categorized emails
      const existingWithCategories = existingEmails.map(e => {
        const prev = emails.find(p => p.id === e.id)
        return prev ? { ...e, category: prev.category, hasMeetingRequest: prev.hasMeetingRequest } : e
      })

      if (newEmails.length > 0) {
        const categorizedNew = await categorizeEmails(newEmails, loadCorrections())
        setEmails([...categorizedNew, ...existingWithCategories])
      } else if (!silent) {
        // Full categorization on manual refresh
        const categorized = await categorizeEmails(raw, loadCorrections())
        setEmails(categorized)
      }
    } catch (err) {
      console.error(err)
      if (!silent) setError('Sähköpostien haku epäonnistui')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // Auto-refresh every 60s when in live mode
  useEffect(() => {
    if (mode !== 'live') return
    const interval = setInterval(() => {
      loadEmails(true)
    }, 60000)
    return () => clearInterval(interval)
  }, [mode, emails])

  async function handleConnect() {
    try {
      if (!clientId) {
        setError('Aseta VITE_GOOGLE_CLIENT_ID .env-tiedostoon')
        return
      }
      await initGoogleAuth(clientId)
      await signIn()
      setMode('live')
      await loadEmails()
    } catch (err) {
      setError('Google-kirjautuminen epäonnistui')
    }
  }

  async function handleRefresh() {
    await loadEmails()
  }

  function handleCategoryChange(emailId, newCategory) {
    // Update UI immediately
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, category: newCategory } : e))

    // Find the email to save a meaningful correction
    const email = emails.find(e => e.id === emailId)
    if (!email) return

    const updated = [
      ...corrections.filter(c => c.emailId !== emailId),
      {
        emailId,
        from: email.from,
        subject: email.subject,
        originalCategory: email.category,
        correctedCategory: newCategory,
      }
    ]
    setCorrections(updated)
    saveCorrection(updated)
  }

  function handleDismiss(emailId) {
    setEmails(prev => prev.map(e =>
      e.id === emailId ? { ...e, category: null } : e
    ))
  }

  function handleDelete(emailId) {
    setEmails(prev => prev.filter(e => e.id !== emailId))
    if (mode === 'live') {
      trashEmail(emailId).catch(err => console.error('Trash failed:', err))
    }
  }

  function handleMarkRead(emailId) {
    // Automaattinen: vain poista UNREAD, pidä kategoria
    setEmails(prev => prev.map(e => {
      if (e.id !== emailId) return e
      const labels = e.labels.filter(l => l !== 'UNREAD')
      return { ...e, labels }
    }))
    if (mode === 'live') {
      toggleReadStatus(emailId, true).catch(err => console.error('Mark read failed:', err))
    }
  }

  function handleToggleRead(emailId) {
    // Toggle UNREAD, pidä kategoria aina
    setEmails(prev => prev.map(e => {
      if (e.id !== emailId) return e
      const isUnread = e.labels.includes('UNREAD')
      const labels = isUnread
        ? e.labels.filter(l => l !== 'UNREAD')
        : [...e.labels, 'UNREAD']
      return { ...e, labels }
    }))
    if (mode === 'live') {
      const email = emails.find(e => e.id === emailId)
      const isUnread = email?.labels.includes('UNREAD')
      toggleReadStatus(emailId, isUnread).catch(err => console.error('Toggle read failed:', err))
    }
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const dateStr = now.toLocaleDateString('fi-FI', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">Sähköpostit</h1>
          <p className="app-subtitle">
            {dateStr} — päivitetty {timeStr}
          </p>
        </div>
        <div className="header-actions">
          {mode === 'demo' && (
            <span className="demo-badge">Demo-tila</span>
          )}
          <button className="btn-secondary" onClick={() => setShowStyleSettings(true)} title="Kirjoitustyyli">
            ✎ Tyyli
          </button>
          <button className="btn-secondary" onClick={handleRefresh} disabled={loading}>
            {loading ? '⟳ Ladataan...' : '⟳ Päivitä'}
          </button>
          {mode === 'demo' && (
            <button className="btn-primary" onClick={handleConnect}>
              Yhdistä Gmail
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="error-bar">
          {error}
          <button onClick={() => setError(null)} className="error-close">✕</button>
        </div>
      )}

      <div className="search-wrapper">
        <span className="search-icon">🔍</span>
        <input
          className="search-input"
          type="text"
          placeholder="Etsi sähköposteja..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Kategorisoidaan sähköposteja...</p>
        </div>
      ) : (
        <>
          <SummaryCards emails={emails} onFilter={setFilter} />
          <CategoryFilter active={filter} onChange={setFilter} emails={emails} />
          <EmailList emails={emails} filter={filter} search={search} onCategoryChange={handleCategoryChange} allEmails={emails} mode={mode} onDelete={handleDelete} onToggleRead={handleToggleRead} onDismiss={handleDismiss} onMarkRead={handleMarkRead} />
        </>
      )}

      <StyleSettings open={showStyleSettings} onClose={() => setShowStyleSettings(false)} />

      <style>{`
        .app-container {
          max-width: 740px;
          margin: 0 auto;
          padding: 2rem 1.5rem 4rem;
        }
        .app-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2.5rem;
          flex-wrap: wrap;
          gap: 16px;
        }
        .app-title {
          font-family: var(--font-display);
          font-size: 36px;
          font-weight: 400;
          line-height: 1.1;
          color: var(--text-primary);
        }
        .app-subtitle {
          font-size: 13px;
          color: var(--text-tertiary);
          margin-top: 4px;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .demo-badge {
          font-size: 11px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: var(--radius-pill);
          background: var(--cat-fyi-bg);
          color: var(--cat-fyi-text);
        }
        .btn-secondary {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          padding: 7px 14px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-secondary:hover { border-color: var(--border-hover); }
        .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          padding: 7px 16px;
          border-radius: var(--radius-pill);
          border: none;
          background: var(--text-primary);
          color: var(--bg-primary);
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-primary:hover { opacity: 0.85; }
        .error-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          border-radius: var(--radius-md);
          background: var(--cat-respond-bg);
          color: var(--cat-respond-text);
          font-size: 13px;
          margin-bottom: 1.5rem;
        }
        .error-close {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font-size: 14px;
        }
        .loading-state {
          text-align: center;
          padding: 4rem 1rem;
          color: var(--text-secondary);
        }
        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid var(--border);
          border-top-color: var(--text-secondary);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          margin: 0 auto 12px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading-state p { font-size: 14px; }

        .search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .search-icon {
          position: absolute;
          left: 14px;
          font-size: 14px;
          pointer-events: none;
        }
        .search-input {
          width: 100%;
          font-family: var(--font-body);
          font-size: 14px;
          padding: 10px 40px 10px 40px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-primary);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .search-input::placeholder { color: var(--text-tertiary); }
        .search-input:focus {
          border-color: var(--cat-respond);
          box-shadow: 0 0 0 3px rgba(236, 28, 38, 0.1);
        }
        .search-clear {
          position: absolute;
          right: 14px;
          background: none;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          font-size: 13px;
          padding: 2px;
        }
        .search-clear:hover { color: var(--text-primary); }

        @media (max-width: 600px) {
          .app-container { padding: 1.25rem 0.75rem 3rem; }
          .app-title { font-size: 26px; }
          .app-subtitle { font-size: 12px; }
          .app-header { flex-direction: column; gap: 10px; }
          .header-actions { flex-wrap: wrap; gap: 6px; }
          .header-actions .btn-secondary,
          .header-actions .btn-primary {
            font-size: 12px;
            padding: 6px 12px;
          }
          .search-input { font-size: 16px; } /* prevents iOS zoom on focus */
          .search-wrapper { margin-bottom: 1rem; }
        }
      `}</style>
    </div>
  )
}
