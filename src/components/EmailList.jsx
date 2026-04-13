import React, { useRef, useState } from 'react'
import { CATEGORIES } from '../lib/categories'
import EmailCard from './EmailCard'

export default function EmailList({ emails, filter, search, onCategoryChange, allEmails, mode, onDelete, onToggleRead, onDismiss, onMarkRead }) {
  const q = search?.toLowerCase().trim() || ''
  const sortOrderRef = useRef(null)
  const [expandedId, setExpandedId] = useState(null)

  const filtered = emails
    .filter(e => {
      if (filter === 'all') return true
      if (e.category === null) return false
      return e.category === filter
    })
    .filter(e => !q || [e.from, e.subject, e.snippet].some(f => f?.toLowerCase().includes(q)))

  // Sorttaa normaalisti
  const freshSorted = filter === 'all'
    ? [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    : [...filtered].sort((a, b) => {
        const aUnread = a.labels.includes('UNREAD') ? 0 : 1
        const bUnread = b.labels.includes('UNREAD') ? 0 : 1
        if (aUnread !== bUnread) return aUnread - bUnread
        return (b.timestamp || 0) - (a.timestamp || 0)
      })

  // Tallenna UNREAD-tila jokaiselle — jos muuttuu, sorttaa uudelleen
  const currentKey = filtered.map(e => e.id + (e.labels.includes('UNREAD') ? ':U' : ':R')).sort().join(',')
  const savedKey = sortOrderRef.current?.key

  function handleResort() {
    setExpandedId(null)
    sortOrderRef.current = null
  }

  function handleExpand(emailId, isExpanded) {
    setExpandedId(isExpanded ? emailId : null)
  }

  let sorted
  if (expandedId && sortOrderRef.current?.ids) {
    // Viesti auki — pidä vanha järjestys ehdottomasti
    sorted = sortOrderRef.current.ids.map(id => filtered.find(e => e.id === id)).filter(Boolean)
  } else if (savedKey === currentKey && sortOrderRef.current?.ids) {
    sorted = sortOrderRef.current.ids.map(id => filtered.find(e => e.id === id)).filter(Boolean)
  } else {
    sorted = freshSorted
    sortOrderRef.current = { key: currentKey, ids: freshSorted.map(e => e.id) }
  }

  if (sorted.length === 0) {
    return (
      <div className="email-empty">
        <p>Ei viestejä tässä kategoriassa</p>
        <style>{`
          .email-empty {
            text-align: center;
            padding: 3rem 1rem;
            color: var(--text-tertiary);
            font-size: 14px;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="email-list">
      {sorted.map((email, i) => (
        <EmailCard
          key={email.id}
          email={email}
          style={{ animationDelay: `${i * 50}ms` }}
          onCategoryChange={onCategoryChange}
          allEmails={allEmails}
          mode={mode}
          onDelete={onDelete}
          onToggleRead={onToggleRead}
          onDismiss={onDismiss}
          onMarkRead={onMarkRead}
          onResort={handleResort}
          onExpand={handleExpand}
        />
      ))}
      <style>{`
        .email-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .email-list .email-card {
          animation: fadeInUp 0.3s ease both;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
