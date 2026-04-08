import React, { useState } from 'react'
import { getStyleDocument, saveStyleDocument } from '../lib/styleContext'

export default function StyleSettings({ open, onClose }) {
  const [text, setText] = useState(() => getStyleDocument())
  const [saved, setSaved] = useState(false)

  if (!open) return null

  function handleSave() {
    saveStyleDocument(text)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="style-overlay" onClick={onClose}>
      <div className="style-modal" onClick={e => e.stopPropagation()}>
        <div className="style-header">
          <h3 className="style-title">Kirjoitustyyli</h3>
          <button className="style-close" onClick={onClose}>x</button>
        </div>
        <p className="style-desc">
          Kuvaile oma kirjoitustyylisi, jotta tekoaly kirjoittaa vastaukset sinun tyylilläsi.
        </p>
        <textarea
          className="style-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={10}
          placeholder={"Esim:\n- Kirjoitan aina suomeksi\n- Käytän lyhyitä ja ytimekkäitä lauseita\n- Aloitan viesteissä usein 'Moi' tai 'Hei'\n- Lopetan viestini 'Ystävällisin terveisin, Anna'\n- Pidän sävyni ystävällisenä mutta asiallisena\n- Käytän joskus huutomerkkejä innostuksen merkiksi"}
        />
        <div className="style-actions">
          <button className="style-save-btn" onClick={handleSave}>
            {saved ? '✓ Tallennettu!' : 'Tallenna'}
          </button>
        </div>
      </div>

      <style>{`
        .style-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .style-modal {
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
          padding: 24px;
          width: 90%;
          max-width: 520px;
          max-height: 80vh;
          overflow-y: auto;
        }
        .style-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .style-title {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 400;
          color: var(--text-primary);
          margin: 0;
        }
        .style-close {
          font-family: var(--font-body);
          font-size: 16px;
          width: 28px;
          height: 28px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: none;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .style-close:hover {
          border-color: var(--border-hover);
          color: var(--text-primary);
        }
        .style-desc {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0 0 12px;
          line-height: 1.5;
        }
        .style-textarea {
          width: 100%;
          font-family: var(--font-body);
          font-size: 13px;
          line-height: 1.6;
          padding: 12px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-primary);
          resize: vertical;
          outline: none;
          box-sizing: border-box;
        }
        .style-textarea:focus {
          border-color: var(--cat-meeting);
        }
        .style-textarea::placeholder {
          color: var(--text-tertiary);
        }
        .style-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 12px;
        }
        .style-save-btn {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          padding: 8px 20px;
          border-radius: var(--radius-pill);
          border: none;
          background: var(--cat-meeting);
          color: white;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .style-save-btn:hover { opacity: 0.85; }
        @media (max-width: 600px) {
          .style-modal {
            width: 100%;
            max-width: 100%;
            max-height: 100vh;
            border-radius: 0;
            padding: 16px;
          }
          .style-textarea { font-size: 16px; } /* prevents iOS zoom */
          .style-title { font-size: 18px; }
        }
      `}</style>
    </div>
  )
}
