import { getSentSamples } from './sentStore'

const STYLE_KEY = 'email_writing_style'
const AUTO_STYLE_KEY = 'email_auto_style_guide'

export function getStyleDocument() {
  return localStorage.getItem(STYLE_KEY) || ''
}

export function saveStyleDocument(text) {
  localStorage.setItem(STYLE_KEY, text)
}

/**
 * Get the auto-generated style guide (updated every 10 sent messages).
 */
export function getAutoStyleGuide() {
  return localStorage.getItem(AUTO_STYLE_KEY) || ''
}

/**
 * Save the auto-generated style guide.
 */
export function saveAutoStyleGuide(text) {
  localStorage.setItem(AUTO_STYLE_KEY, text)
}

/**
 * Build complete style context string for draft generation prompts.
 * Combines: manual style guide + auto-learned style guide + 3 recent sent examples.
 * Token-efficient: ~500 tokens total.
 */
export function buildStyleContext() {
  const manualGuide = getStyleDocument()
  const autoGuide = getAutoStyleGuide()
  const recentSamples = getSentSamples(3)

  const parts = []

  // Manual style guide (user-written)
  if (manualGuide) {
    parts.push(`Käyttäjän kirjoitustyyliohje:\n${manualGuide}`)
  }

  // Auto-learned style guide (AI-generated from sent messages)
  if (autoGuide) {
    parts.push(`Opittu kirjoitustyyli (analysoitu aiemmista viesteistä):\n${autoGuide}`)
  }

  // Recent sent examples (3 most recent, max 300 chars each)
  if (recentSamples.length > 0) {
    const formatted = recentSamples.map((s, i) =>
      `${i + 1}. Re: ${s.subject} → ${s.recipient}\n${s.body.slice(0, 300)}`
    ).join('\n\n')
    parts.push(`Käyttäjän viimeisimmät lähetetyt viestit tyyliesimerkkeinä:\n${formatted}`)
  }

  return parts.join('\n\n')
}
