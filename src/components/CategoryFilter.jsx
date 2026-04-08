import React from 'react'
import { CATEGORIES } from '../lib/categories'

export default function CategoryFilter({ active, onChange, emails }) {
  const counts = {}
  Object.keys(CATEGORIES).forEach((k) => (counts[k] = 0))
  emails.forEach((e) => {
    if (e.category && counts[e.category] !== undefined) counts[e.category]++
  })

  return (
    <div className="cat-filter">
      <button
        className={`cat-pill ${active === 'all' ? 'active' : ''}`}
        onClick={() => onChange('all')}
      >
        Kaikki
        <span className="cat-count">{emails.length}</span>
      </button>
      {Object.entries(CATEGORIES).map(([name, cfg]) => (
        <button
          key={name}
          className={`cat-pill ${active === name ? 'active' : ''}`}
          onClick={() => onChange(name)}
          style={
            active === name
              ? { background: cfg.bg, color: cfg.text, borderColor: 'transparent' }
              : {}
          }
        >
          <span
            className="cat-dot"
            style={{ background: cfg.color }}
          />
          {name}
          {name !== 'Lähetetyt' && <span className="cat-count">{counts[name]}</span>}
        </button>
      ))}
      <style>{`
        .cat-filter {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
        }
        .cat-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--border);
          background: var(--bg-card);
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          transition: all 0.15s ease;
        }
        .cat-pill:hover {
          border-color: var(--border-hover);
          background: var(--bg-secondary);
        }
        .cat-pill.active {
          color: var(--text-primary);
          border-color: var(--border-hover);
          background: var(--bg-secondary);
        }
        .cat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .cat-count {
          font-size: 11px;
          background: var(--bg-secondary);
          padding: 1px 6px;
          border-radius: var(--radius-pill);
          color: var(--text-tertiary);
        }
        @media (max-width: 600px) {
          .cat-filter {
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            margin-bottom: 1rem;
            padding-bottom: 4px;
          }
          .cat-filter::-webkit-scrollbar { display: none; }
          .cat-pill {
            flex-shrink: 0;
            font-size: 12px;
            padding: 5px 12px;
          }
        }
      `}</style>
    </div>
  )
}
