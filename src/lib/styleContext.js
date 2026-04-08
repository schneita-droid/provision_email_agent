const STYLE_KEY = 'email_writing_style'

export function getStyleDocument() {
  return localStorage.getItem(STYLE_KEY) || ''
}

export function saveStyleDocument(text) {
  localStorage.setItem(STYLE_KEY, text)
}

export function getSentEmailSamples(emails, max = 3) {
  return emails
    .filter(e => e.direction === 'out')
    .slice(0, max)
    .map(e => `Subject: ${e.subject}\n${e.snippet}`)
    .join('\n---\n')
}

export function buildStyleContext(emails) {
  const doc = getStyleDocument()
  const samples = getSentEmailSamples(emails)

  const parts = []
  if (doc) {
    parts.push(`Writing style guide:\n${doc}`)
  }
  if (samples) {
    parts.push(`Examples of the user's previous emails:\n${samples}`)
  }
  return parts.join('\n\n')
}
