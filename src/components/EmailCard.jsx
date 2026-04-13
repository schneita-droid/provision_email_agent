import React, { useState, useRef, useEffect } from 'react'
import { CATEGORIES, CATEGORY_NAMES } from '../lib/categories'
import { generateDraft, generateVoiceDraft } from '../lib/draft'
import { buildStyleContext, getStyleDocument, getAutoStyleGuide, saveAutoStyleGuide } from '../lib/styleContext'
import { saveSentSample, getSentSamples, shouldUpdateStyleGuide } from '../lib/sentStore'
import { sendReply, scheduleReply, fetchEmailBody, fetchThread } from '../lib/gmail'
import { fetchFreeSlots, formatFreeSlotsText } from '../lib/calendar'
import { buildCalendarContext } from '../lib/calendarContext'

const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null

function ThreadMessage({ msg, defaultExpanded }) {
  const [msgExpanded, setMsgExpanded] = useState(defaultExpanded)
  return (
    <div className={`thread-message${msg.isSent ? ' thread-sent' : ''}${msgExpanded ? ' thread-expanded' : ' thread-collapsed'}`}>
      <div className="thread-msg-header" onClick={(e) => { e.stopPropagation(); setMsgExpanded(!msgExpanded) }}>
        <span className="thread-msg-from">{msg.isSent ? 'Minä' : msg.from}</span>
        {!msgExpanded && (
          <span className="thread-msg-snippet">{msg.body?.text?.substring(0, 80) || '...'}</span>
        )}
        <span className="thread-msg-date">{msg.date}</span>
      </div>
      {msgExpanded && (
        <div className="thread-msg-body">
          {msg.body?.html ? (
            <div className="email-body-html" dangerouslySetInnerHTML={{ __html: msg.body.html }} />
          ) : msg.body?.text ? (
            <div className="email-body-text">{msg.body.text}</div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default function EmailCard({ email, style, onCategoryChange, allEmails, mode, onDelete, onToggleRead, onDismiss, onMarkRead, onResort, onExpand }) {
  const cat = CATEGORIES[email.category] || { color: 'var(--border)', bg: 'var(--bg-secondary)', text: 'var(--text-tertiary)', order: 99 }
  const [showMenu, setShowMenu] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [showScheduler, setShowScheduler] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduled, setScheduled] = useState(false)
  const [sendError, setSendError] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  const [freeSlots, setFreeSlots] = useState(null)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [otherEmail, setOtherEmail] = useState('')
  const [calendarDays, setCalendarDays] = useState(7)
  const [emailBody, setEmailBody] = useState(null)
  const [loadingBody, setLoadingBody] = useState(false)
  const [threadMessages, setThreadMessages] = useState(null)
  const [loadingThread, setLoadingThread] = useState(false)
  const recognitionRef = useRef(null)
  const moveRef = useRef(null)

  useEffect(() => {
    if (!showMenu) return
    function handleClickOutside(e) {
      if (moveRef.current && !moveRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  function handleMove(newCategory) {
    setShowMenu(false)
    if (newCategory !== email.category) {
      onCategoryChange(email.id, newCategory)
    }
  }

  function handleCardClick(e) {
    if (e.target.closest('.move-wrapper') || e.target.closest('.draft-section') || e.target.closest('.calendar-section') || e.target.closest('.email-hover-actions')) return
    const willExpand = !expanded
    setExpanded(willExpand)
    onExpand(email.id, willExpand)
    if (!willExpand) {
      onResort()
    }
    if (willExpand) {
      // Avaaminen: merkitse luetuksi (pallo pois) mutta pidä kategoriassa
      if (email.labels.includes('UNREAD')) {
        onMarkRead(email.id)
      }
      // Hae koko viestiketju
      if (!threadMessages && mode === 'live' && email.threadId) {
        setLoadingThread(true)
        fetchThread(email.threadId)
          .then(msgs => setThreadMessages(msgs))
          .catch(() => setThreadMessages(null))
          .finally(() => setLoadingThread(false))
      }
      if (email.hasMeetingRequest && freeSlots === null) {
        handleCheckCalendar()
      }
    }
  }

  async function handleDraft() {
    setDrafting(true)
    setDraft('')
    try {
      const calCtx = freeSlots ? buildCalendarContext(freeSlots) : ''
      const styleCtx = buildStyleContext()
      const result = await generateDraft(email, calCtx, styleCtx)
      setDraft(result)
    } catch {
      setDraft('Luonnoksen luominen epäonnistui. Yritä uudelleen.')
    } finally {
      setDrafting(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleVoiceInput() {
    if (!SpeechRecognition) {
      setTranscript('Selain ei tue puheentunnistusta. Käytä Chromea tai Edgeä.')
      return
    }

    if (recording) {
      recognitionRef.current?.stop()
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'fi-FI'
    recognition.continuous = true
    recognition.interimResults = true
    recognitionRef.current = recognition
    let fullTranscript = ''

    recognition.onstart = () => setRecording(true)

    recognition.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      fullTranscript = text
      setTranscript(text)
    }

    recognition.onerror = (event) => {
      setRecording(false)
      if (event.error === 'not-allowed') {
        setTranscript('Mikrofoni estetty. Salli mikrofoni selaimen asetuksista.')
      } else if (event.error !== 'aborted') {
        setTranscript('Puheentunnistus epäonnistui. Yritä uudelleen.')
      }
    }

    recognition.onend = async () => {
      setRecording(false)
      if (!fullTranscript) return
      setDrafting(true)
      setDraft('')
      try {
        const styleCtx = buildStyleContext()
        const calCtx = freeSlots ? buildCalendarContext(freeSlots) : ''
        const result = await generateVoiceDraft(email, fullTranscript, styleCtx, calCtx)
        setDraft(result)
      } catch {
        setDraft('Luonnoksen luominen epäonnistui. Yritä uudelleen.')
      } finally {
        setDrafting(false)
      }
    }

    recognition.start()
  }

  async function handleCheckCalendar(extraEmail, days = calendarDays) {
    setCalendarLoading(true)
    setShowCalendar(true)
    try {
      const now = new Date()
      const end = new Date(now)
      end.setDate(now.getDate() + days)
      const calendarIds = ['primary']
      if (extraEmail) calendarIds.push(extraEmail)
      const slots = await fetchFreeSlots(now, end, calendarIds)
      setFreeSlots(slots)
    } catch {
      setFreeSlots([])
    } finally {
      setCalendarLoading(false)
    }
  }

  function insertSlotToDraft(slot) {
    const text = `${slot.date} klo ${slot.timeRange}`
    setDraft(prev => prev ? prev + `\n\n${text}` : text)
  }

  async function handleSend() {
    if (mode !== 'live') {
      setSendError('Yhdistä Gmail lähettääksesi')
      return
    }
    setSending(true)
    setSendError('')
    try {
      await sendReply(email, draft)
      setSent(true)

      // Save sent message for AI learning
      const newCount = await saveSentSample(email, draft)

      // Every 10th message: update style guide in background (don't await)
      if (shouldUpdateStyleGuide(newCount)) {
        updateStyleGuideInBackground()
      }
    } catch (err) {
      setSendError(err.message || 'Lähetys epäonnistui')
    } finally {
      setSending(false)
    }
  }

  async function updateStyleGuideInBackground() {
    try {
      const currentGuide = (await getStyleDocument()) || (await getAutoStyleGuide())
      const recentMessages = await getSentSamples(10)
      if (recentMessages.length === 0) return

      const resp = await fetch('/api/update-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStyleGuide: currentGuide, recentMessages }),
      })

      if (resp.ok) {
        const data = await resp.json()
        if (data.styleGuide) {
          await saveAutoStyleGuide(data.styleGuide)
        }
      }
    } catch {
      // Silent fail — style update is non-critical
    }
  }

  function handleSchedule() {
    if (mode !== 'live') {
      setSendError('Yhdistä Gmail lähettääksesi')
      return
    }
    if (!scheduleDate || !scheduleTime) return
    const sendAt = new Date(`${scheduleDate}T${scheduleTime}`)
    if (sendAt <= new Date()) {
      setSendError('Valitse tuleva ajankohta')
      return
    }
    setSendError('')
    scheduleReply(email, draft, sendAt)
    setScheduled(true)
    setShowScheduler(false)
  }

  return (
    <div className="email-card" style={style} onClick={handleCardClick}>
      <div className="email-priority-bar" style={{ background: email.category ? cat.color : 'transparent' }} />
      <div className="email-content">
        <div className="email-header">
          <span className="email-from">
            {email.direction === 'out' && (
              <span className="email-direction">↗</span>
            )}
            {email.from}
          </span>
          <span className="email-date">{email.date}</span>
          <div className="email-hover-actions">
            <button
              className="hover-action-pill"
              onClick={(e) => {
                e.stopPropagation()
                onToggleRead(email.id)
                // Jos merkitään lukemattomaksi, sulje viesti
                if (!email.labels.includes('UNREAD')) {
                  setExpanded(false)
                  onExpand(email.id, false)
                  onResort()
                }
              }}
            >
              {email.labels.includes('UNREAD') ? 'Merkkaa luetuksi' : 'Merkkaa lukemattomaksi'}
            </button>
            <button
              className="hover-action-pill hover-delete"
              onClick={(e) => { e.stopPropagation(); onDelete(email.id) }}
            >
              Poista
            </button>
          </div>
        </div>
        <div className="email-subject">{email.subject}</div>
        {!expanded && (
          <div className="email-snippet" style={{ WebkitLineClamp: 1, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal' }}>
            {email.snippet}
          </div>
        )}
        {expanded && (
          <div className="email-thread">
            {loadingThread && (
              <div className="draft-loading">
                <div className="draft-spinner" /> Ladataan viestiketjua...
              </div>
            )}
            {threadMessages ? (
              threadMessages.map((msg, i) => (
                <ThreadMessage
                  key={msg.id}
                  msg={msg}
                  defaultExpanded={i === threadMessages.length - 1}
                />
              ))
            ) : !loadingThread ? (
              <div className="email-snippet" style={{ whiteSpace: 'normal' }}>
                {email.snippet}
              </div>
            ) : null}
          </div>
        )}

        {expanded && email.direction === 'in' && (
          <div className="draft-section">
            {!draft && !drafting && !recording && (
              <div className="draft-btn-group">
                <button className="draft-btn" onClick={handleDraft}>
                  ✍ Kirjoita vastausluonnos
                </button>
                <button className="voice-btn" onClick={handleVoiceInput} title="Sanele vastaus">
                  🎤 Sanele vastaus
                </button>
              </div>
            )}
            {recording && (
              <div className="voice-recording">
                <span className="voice-pulse" />
                <span>Kuuntelen...</span>
                <button className="voice-stop-btn" onClick={handleVoiceInput}>
                  Lopeta
                </button>
              </div>
            )}
            {transcript && !recording && !drafting && !draft && (
              <div className="voice-transcript">
                <span className="voice-transcript-label">Sanelusi:</span> {transcript}
              </div>
            )}
            {drafting && (
              <div className="draft-loading">
                <div className="draft-spinner" /> Kirjoitetaan luonnosta...
              </div>
            )}
            {draft && !sent && !scheduled && (
              <div className="draft-result">
                <textarea
                  className="draft-textarea"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={6}
                />
                <div className="draft-actions">
                  <button className="send-btn" onClick={handleSend} disabled={sending}>
                    {sending ? 'Lähetetään...' : 'Lähetä'}
                  </button>
                  <button className="schedule-btn" onClick={() => setShowScheduler(!showScheduler)}>
                    Ajasta
                  </button>
                  <button className="draft-copy-btn" onClick={handleCopy}>
                    {copied ? '✓ Kopioitu!' : 'Kopioi'}
                  </button>
                  <button className="draft-retry-btn" onClick={handleDraft}>
                    ↺ Uudelleen
                  </button>
                  <button className="voice-redo-btn" onClick={handleVoiceInput}>
                    🎤 Sanele
                  </button>
                </div>
                {showScheduler && (
                  <div className="schedule-picker">
                    <input
                      type="date"
                      className="schedule-input"
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <input
                      type="time"
                      className="schedule-input"
                      value={scheduleTime}
                      onChange={e => setScheduleTime(e.target.value)}
                    />
                    <button className="schedule-confirm-btn" onClick={handleSchedule}>
                      Ajasta lähetys
                    </button>
                  </div>
                )}
                {sendError && (
                  <div className="send-error">{sendError}</div>
                )}
              </div>
            )}
            {sent && (
              <div className="send-success">✓ Lähetetty!</div>
            )}
            {scheduled && (
              <div className="send-success">✓ Ajastettu! Viesti lähetetään {scheduleDate} klo {scheduleTime}</div>
            )}
          </div>
        )}

        {expanded && email.direction === 'in' && (
          <div className="calendar-section">
            {!showCalendar && !email.hasMeetingRequest && (
              <button className="calendar-btn" onClick={() => handleCheckCalendar()}>
                📅 Tarkista kalenteri
              </button>
            )}
            {calendarLoading && (
              <div className="draft-loading">
                <div className="draft-spinner" /> Haetaan vapaita aikoja...
              </div>
            )}
            {showCalendar && freeSlots && !calendarLoading && (
              <div className="calendar-result">
                <div className="calendar-header-row">
                  <span className="calendar-label">📅 Vapaat ajat</span>
                  <div className="calendar-range">
                    {[7, 14, 30, 90].map(d => (
                      <button
                        key={d}
                        className={`calendar-range-btn${calendarDays === d ? ' active' : ''}`}
                        onClick={() => { setCalendarDays(d); handleCheckCalendar(otherEmail || undefined, d) }}
                      >
                        {d <= 30 ? `${d} pv` : '3 kk'}
                      </button>
                    ))}
                  </div>
                </div>
                {freeSlots.length === 0 ? (
                  <div className="calendar-empty">Ei vapaita aikoja lähipäivinä</div>
                ) : (
                  <div className="calendar-week-view">
                    <div className="calendar-week-header">
                      <span>Ma</span><span>Ti</span><span>Ke</span><span>To</span><span>Pe</span>
                    </div>
                    {(() => {
                      // Group slots by date string, then arrange into week rows
                      const slotsByDate = {}
                      for (const slot of freeSlots) {
                        const d = new Date(slot.start)
                        const key = d.toISOString().split('T')[0]
                        if (!slotsByDate[key]) slotsByDate[key] = { date: d, slots: [] }
                        slotsByDate[key].slots.push(slot)
                      }

                      // Find first Monday on or before first slot
                      const dates = Object.values(slotsByDate).map(d => d.date)
                      if (!dates.length) return null
                      const first = new Date(Math.min(...dates))
                      const firstMonday = new Date(first)
                      const dow = firstMonday.getDay()
                      firstMonday.setDate(firstMonday.getDate() - (dow === 0 ? 6 : dow - 1))

                      // Find last date
                      const last = new Date(Math.max(...dates))

                      // Build weeks
                      const weeks = []
                      const current = new Date(firstMonday)
                      while (current <= last) {
                        const week = []
                        for (let d = 0; d < 5; d++) {
                          const key = current.toISOString().split('T')[0]
                          const dayNum = current.getDate()
                          const month = current.getMonth() + 1
                          week.push({ key, label: `${dayNum}.${month}.`, slots: slotsByDate[key]?.slots || [] })
                          current.setDate(current.getDate() + 1)
                        }
                        current.setDate(current.getDate() + 2) // skip weekend
                        weeks.push(week)
                      }

                      return weeks.map((week, wi) => (
                        <div key={wi} className="calendar-week-row">
                          {week.map((day, di) => (
                            <div key={di} className={`calendar-day-cell${day.slots.length ? '' : ' empty'}`}>
                              <span className="calendar-day-label">{day.label}</span>
                              {day.slots.map((slot, si) => (
                                <button
                                  key={si}
                                  className="calendar-day-slot"
                                  onClick={() => insertSlotToDraft(slot)}
                                  title="Lisää luonnokseen"
                                >
                                  {slot.timeRange}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      ))
                    })()}
                  </div>
                )}
                <div className="calendar-other">
                  <input
                    className="calendar-email-input"
                    type="email"
                    placeholder="Toisen henkilön sähköposti"
                    value={otherEmail}
                    onChange={e => setOtherEmail(e.target.value)}
                  />
                  <button
                    className="calendar-check-btn"
                    onClick={() => handleCheckCalendar(otherEmail)}
                    disabled={!otherEmail}
                  >
                    Hae yhteiset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="email-footer">
          {email.category && (
            <span
              className="email-badge"
              style={{ background: cat.bg, color: cat.text }}
            >
              {email.category}
            </span>
          )}
          {email.labels.includes('UNREAD') && (
            <span className="email-unread-dot" />
          )}
          <div className="move-wrapper" ref={moveRef}>
            <button
              className="move-btn"
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
              title="Siirrä kategoriaan"
            >
              Siirrä ↓
            </button>
            {expanded && (
              <button
                className="move-btn"
                onClick={(e) => { e.stopPropagation(); setExpanded(false); onExpand(email.id, false); onResort() }}
              >
                Sulje ✕
              </button>
            )}
            {expanded && (
              <button
                className="move-btn hover-delete"
                onClick={(e) => { e.stopPropagation(); onDelete(email.id) }}
              >
                Poista
              </button>
            )}
            {showMenu && (
              <div className="move-menu">
                {CATEGORY_NAMES.filter(c => c !== email.category && c !== 'Lähetetyt').map(c => {
                  const mc = CATEGORIES[c]
                  return (
                    <button
                      key={c}
                      className="move-menu-item"
                      onClick={() => handleMove(c)}
                    >
                      <span className="move-menu-dot" style={{ background: mc.color }} />
                      {c}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .email-card {
          display: flex;
          gap: 12px;
          padding: 14px 16px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          background: var(--bg-card);
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
        }
        .email-card:hover {
          border-color: var(--border-hover);
          box-shadow: var(--shadow-card);
          transform: translateY(-1px);
        }
        .email-priority-bar {
          width: 4px;
          min-height: 44px;
          border-radius: 2px;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .email-content {
          flex: 1;
          min-width: 0;
        }
        .email-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3px;
        }
        .email-from {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 70%;
        }
        .email-direction {
          color: var(--text-tertiary);
          margin-right: 4px;
          font-size: 12px;
        }
        .email-date {
          font-size: 12px;
          color: var(--text-tertiary);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .email-hover-actions {
          display: none;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }
        .email-card:hover .email-hover-actions {
          display: flex;
        }
        .email-card:hover .email-date {
          display: none;
        }
        .hover-action-pill {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          padding: 3px 10px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s;
        }
        .hover-action-pill:hover {
          border-color: var(--border-hover);
          color: var(--text-primary);
        }
        .hover-delete:hover {
          border-color: var(--cat-respond);
          color: var(--cat-respond);
        }
        .email-subject {
          font-size: 13px;
          color: var(--text-primary);
          margin-bottom: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .email-snippet {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-bottom: 2px;
        }
        .email-thread {
          margin: 8px 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 500px;
          overflow-y: auto;
        }
        .thread-message {
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 10px 12px;
          background: var(--bg-card);
        }
        .thread-message.thread-collapsed {
          cursor: pointer;
          opacity: 0.7;
        }
        .thread-message.thread-collapsed:hover {
          opacity: 1;
          border-color: var(--border-hover);
        }
        .thread-message.thread-sent {
          background: var(--cat-meeting-bg, #EBF4FF);
        }
        .thread-message.thread-sent.thread-expanded {
          border-color: var(--cat-meeting);
        }
        .thread-msg-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .thread-expanded .thread-msg-header {
          margin-bottom: 8px;
        }
        .thread-msg-from {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          flex-shrink: 0;
        }
        .thread-sent .thread-msg-from {
          color: var(--cat-meeting);
        }
        .thread-msg-snippet {
          font-size: 12px;
          color: var(--text-tertiary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          min-width: 0;
        }
        .thread-msg-date {
          font-size: 11px;
          color: var(--text-tertiary);
          flex-shrink: 0;
          margin-left: auto;
        }
        .thread-msg-body {
          font-size: 13px;
          line-height: 1.6;
        }
        .email-body {
          margin: 8px 0;
        }
        .email-body-html {
          font-size: 13px;
          line-height: 1.6;
          color: var(--text-primary);
          overflow-x: auto;
          word-break: break-word;
        }
        .email-body-html img {
          max-width: 100%;
          height: auto;
        }
        .email-body-html table {
          max-width: 100%;
          overflow-x: auto;
          display: block;
        }
        .email-body-html a {
          color: var(--cat-meeting);
        }
        .email-body-text {
          font-size: 13px;
          line-height: 1.6;
          color: var(--text-primary);
          white-space: pre-wrap;
          word-break: break-word;
        }
        .email-footer {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
        }
        .email-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 500;
          padding: 2px 10px;
          border-radius: var(--radius-pill);
        }
        .email-unread-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--cat-respond);
        }
        .move-wrapper {
          position: relative;
          margin-left: auto;
        }
        .move-btn {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s;
        }
        .move-btn:hover {
          border-color: var(--border-hover);
          color: var(--text-primary);
        }
        .move-menu {
          position: absolute;
          bottom: calc(100% + 6px);
          right: 0;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          z-index: 100;
          min-width: 160px;
          overflow: hidden;
        }
        .move-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          border: none;
          background: none;
          color: var(--text-primary);
          cursor: pointer;
          text-align: left;
          transition: background 0.1s;
        }
        .move-menu-item:hover {
          background: var(--bg-secondary);
        }
        .move-menu-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .draft-section {
          margin: 10px 0 6px;
        }
        .draft-btn {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          padding: 6px 14px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--cat-respond);
          background: var(--cat-respond-bg);
          color: var(--cat-respond-text);
          cursor: pointer;
          transition: all 0.15s;
        }
        .draft-btn:hover {
          background: var(--cat-respond);
          color: white;
        }
        .draft-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
          padding: 6px 0;
        }
        .draft-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid var(--border);
          border-top-color: var(--cat-respond);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .draft-result {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .draft-textarea {
          width: 100%;
          font-family: var(--font-body);
          font-size: 13px;
          line-height: 1.6;
          padding: 10px 12px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-primary);
          resize: vertical;
          outline: none;
        }
        .draft-textarea:focus {
          border-color: var(--cat-respond);
        }
        .draft-actions {
          display: flex;
          gap: 8px;
        }
        .draft-copy-btn {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          padding: 5px 14px;
          border-radius: var(--radius-pill);
          border: none;
          background: var(--cat-respond);
          color: white;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .draft-copy-btn:hover { opacity: 0.85; }
        .draft-retry-btn {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          padding: 5px 14px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--border);
          background: none;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s;
        }
        .draft-retry-btn:hover {
          border-color: var(--border-hover);
          color: var(--text-primary);
        }
        .draft-btn-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .voice-btn {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          padding: 6px 14px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--cat-meeting);
          background: var(--cat-meeting-bg, #EBF4FF);
          color: var(--cat-meeting-text, #1A4971);
          cursor: pointer;
          transition: all 0.15s;
        }
        .voice-btn:hover {
          background: var(--cat-meeting);
          color: white;
        }
        .voice-recording {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--cat-respond);
          font-weight: 500;
          padding: 6px 0;
        }
        .voice-pulse {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--cat-respond);
          animation: pulse 1s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        .voice-stop-btn {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          padding: 3px 10px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--cat-respond);
          background: none;
          color: var(--cat-respond);
          cursor: pointer;
          margin-left: auto;
        }
        .voice-stop-btn:hover {
          background: var(--cat-respond);
          color: white;
        }
        .voice-transcript {
          font-size: 12px;
          color: var(--text-secondary);
          padding: 6px 0;
          font-style: italic;
        }
        .voice-transcript-label {
          font-weight: 500;
          font-style: normal;
          color: var(--text-primary);
        }
        .voice-redo-btn {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          padding: 5px 14px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--cat-meeting);
          background: none;
          color: var(--cat-meeting);
          cursor: pointer;
          transition: all 0.15s;
        }
        .voice-redo-btn:hover {
          background: var(--cat-meeting);
          color: white;
        }
        .send-btn {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          padding: 5px 16px;
          border-radius: var(--radius-pill);
          border: none;
          background: var(--cat-notification);
          color: white;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .send-btn:hover { opacity: 0.85; }
        .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .schedule-btn {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          padding: 5px 14px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--cat-meeting);
          background: none;
          color: var(--cat-meeting);
          cursor: pointer;
          transition: all 0.15s;
        }
        .schedule-btn:hover {
          background: var(--cat-meeting);
          color: white;
        }
        .schedule-picker {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          flex-wrap: wrap;
        }
        .schedule-input {
          font-family: var(--font-body);
          font-size: 12px;
          padding: 5px 10px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-primary);
          outline: none;
        }
        .schedule-input:focus {
          border-color: var(--cat-meeting);
        }
        .schedule-confirm-btn {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          padding: 5px 14px;
          border-radius: var(--radius-pill);
          border: none;
          background: var(--cat-meeting);
          color: white;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .schedule-confirm-btn:hover { opacity: 0.85; }
        .send-error {
          font-size: 12px;
          color: var(--cat-respond);
          margin-top: 6px;
        }
        .send-success {
          font-size: 13px;
          font-weight: 500;
          color: var(--cat-notification);
          padding: 8px 0;
        }
        .calendar-section {
          margin: 6px 0;
        }
        .calendar-btn {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          padding: 5px 12px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--border);
          background: none;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s;
        }
        .calendar-btn:hover {
          border-color: var(--cat-meeting);
          color: var(--cat-meeting);
        }
        .calendar-result {
          background: var(--bg-secondary);
          border-radius: var(--radius-md);
          padding: 10px 12px;
        }
        .calendar-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .calendar-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-primary);
        }
        .calendar-range {
          display: flex;
          gap: 4px;
        }
        .calendar-range-btn {
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--border);
          background: none;
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all 0.15s;
        }
        .calendar-range-btn:hover {
          border-color: var(--cat-meeting);
          color: var(--cat-meeting);
        }
        .calendar-range-btn.active {
          background: var(--cat-meeting);
          border-color: var(--cat-meeting);
          color: white;
        }
        .calendar-empty {
          font-size: 12px;
          color: var(--text-tertiary);
          padding: 4px 0;
        }
        .calendar-week-view {
          margin-bottom: 8px;
          max-height: 300px;
          overflow-y: auto;
        }
        .calendar-week-header {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 2px;
          margin-bottom: 2px;
        }
        .calendar-week-header span {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-tertiary);
          text-align: center;
          padding: 2px 0;
        }
        .calendar-week-row {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 2px;
          margin-bottom: 2px;
        }
        .calendar-day-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 4px;
          border-radius: var(--radius-sm);
          background: var(--bg-card);
          border: 1px solid var(--border);
          min-height: 48px;
        }
        .calendar-day-cell.empty {
          opacity: 0.4;
        }
        .calendar-day-label {
          font-size: 9px;
          font-weight: 600;
          color: var(--text-tertiary);
        }
        .calendar-day-slot {
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 500;
          color: var(--cat-meeting);
          background: var(--cat-meeting-bg, #EBF4FF);
          border: none;
          border-radius: 3px;
          padding: 2px 4px;
          cursor: pointer;
          text-align: left;
          transition: all 0.1s;
        }
        .calendar-day-slot:hover {
          background: var(--cat-meeting);
          color: white;
        }
        .calendar-other {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .calendar-email-input {
          flex: 1;
          font-family: var(--font-body);
          font-size: 12px;
          padding: 5px 10px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-primary);
          outline: none;
        }
        .calendar-email-input:focus {
          border-color: var(--cat-meeting);
        }
        .calendar-email-input::placeholder {
          color: var(--text-tertiary);
        }
        .calendar-check-btn {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          padding: 5px 10px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--cat-meeting);
          background: none;
          color: var(--cat-meeting);
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .calendar-check-btn:hover {
          background: var(--cat-meeting);
          color: white;
        }
        .calendar-check-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        @media (max-width: 600px) {
          .email-card { padding: 10px 12px; gap: 8px; }
          .email-from { font-size: 13px; max-width: 60%; }
          .email-date { font-size: 11px; }
          .email-subject { font-size: 12px; }
          .email-snippet { font-size: 11px; }
          .draft-btn-group { flex-direction: column; gap: 6px; }
          .draft-btn, .voice-btn { font-size: 12px; padding: 8px 14px; min-height: 44px; }
          .draft-actions { flex-wrap: wrap; gap: 6px; }
          .send-btn, .schedule-btn, .draft-copy-btn, .draft-retry-btn, .voice-redo-btn {
            font-size: 11px;
            padding: 8px 12px;
            min-height: 44px;
          }
          .draft-textarea { font-size: 14px; } /* prevents iOS zoom */
          .calendar-week-view { max-height: 250px; overflow-x: auto; }
          .calendar-week-header, .calendar-week-row { min-width: 400px; }
          .calendar-day-slot { font-size: 9px; }
          .calendar-day-label { font-size: 8px; }
          .calendar-range-btn { font-size: 9px; padding: 3px 6px; }
          .calendar-other { flex-wrap: wrap; }
          .calendar-email-input { font-size: 16px; min-width: 0; } /* prevents iOS zoom */
          .schedule-picker { flex-direction: column; }
          .schedule-input { font-size: 16px; width: 100%; } /* prevents iOS zoom */
        }
      `}</style>
    </div>
  )
}
