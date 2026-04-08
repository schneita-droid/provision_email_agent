import React from 'react'
import { CATEGORIES } from '../lib/categories'

export default function SummaryCards({ emails, onFilter }) {
  const counts = {}
  Object.keys(CATEGORIES).forEach((k) => (counts[k] = 0))
  emails.forEach((e) => {
    if (e.category && counts[e.category] !== undefined && e.labels.includes('UNREAD')) counts[e.category]++
  })

  return (
    <div className="summary-grid">
      {Object.entries(CATEGORIES).filter(([name]) => name !== 'Lähetetyt').map(([name, cfg]) => (
        <div key={name} className="summary-card" onClick={() => onFilter(name)}>
          <span className="summary-number" style={{ color: cfg.color }}>
            {counts[name]}
          </span>
          <span className="summary-label">{name}</span>
        </div>
      ))}
      <style>{`
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
          gap: 8px;
          margin-bottom: 2rem;
        }
        .summary-card {
          background: var(--bg-secondary);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .summary-card:hover {
          background: var(--bg-card);
          box-shadow: var(--shadow-card);
          transform: translateY(-1px);
        }
        .summary-number {
          font-family: var(--font-display);
          font-size: 32px;
          line-height: 1;
        }
        .summary-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-secondary);
          letter-spacing: 0.02em;
        }
        @media (max-width: 600px) {
          .summary-grid {
            display: flex;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            gap: 6px;
            margin-bottom: 1.25rem;
            padding-bottom: 4px;
          }
          .summary-grid::-webkit-scrollbar { display: none; }
          .summary-card {
            min-width: 90px;
            flex-shrink: 0;
            scroll-snap-align: start;
            padding: 10px 12px;
          }
          .summary-number { font-size: 26px; }
          .summary-label { font-size: 10px; }
        }
      `}</style>
    </div>
  )
}
