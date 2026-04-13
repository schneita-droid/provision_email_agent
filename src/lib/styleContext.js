import { loadUserData, saveUserData } from './userStore'
import { getSentSamples } from './sentStore'

const STYLE_KEY = 'email_writing_style'
const AUTO_STYLE_KEY = 'email_auto_style_guide'

export async function getStyleDocument() {
  const doc = await loadUserData(STYLE_KEY)
  return typeof doc === 'string' ? doc : ''
}

export async function saveStyleDocument(text) {
  await saveUserData(STYLE_KEY, text)
}

/**
 * Get the auto-generated style guide (updated every 10 sent messages).
 */
export async function getAutoStyleGuide() {
  const guide = await loadUserData(AUTO_STYLE_KEY)
  return typeof guide === 'string' ? guide : ''
}

/**
 * Save the auto-generated style guide.
 */
export async function saveAutoStyleGuide(text) {
  await saveUserData(AUTO_STYLE_KEY, text)
}

/**
 * Build complete style context string for draft generation prompts.
 * Combines: manual style guide + auto-learned style guide + 3 recent sent examples.
 * Token-efficient: ~500 tokens total.
 */
export async function buildStyleContext() {
  const [manualGuide, autoGuide, recentSamples] = await Promise.all([
    getStyleDocument(),
    getAutoStyleGuide(),
    getSentSamples(3),
  ])

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
