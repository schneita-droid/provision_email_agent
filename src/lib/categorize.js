import { CATEGORY_NAMES } from './categories'

/**
 * Categorize emails using Claude API via backend.
 */
export async function categorizeEmails(emails, corrections = []) {
  try {
    const resp = await fetch('/api/categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails, corrections }),
    })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      console.warn('API categorization failed, using rules:', err)
      return categorizeWithRules(emails)
    }

    return await resp.json()
  } catch (err) {
    console.error('AI categorization failed, using rules:', err)
    return categorizeWithRules(emails)
  }
}

/**
 * Rule-based fallback categorization
 */
export function categorizeWithRules(emails) {
  return emails.map((e) => {
    const subj = e.subject.toLowerCase()
    const snippet = e.snippet.toLowerCase()
    const isIncoming = e.direction === 'in'
    const isUnread = e.labels.includes('UNREAD')

    const meetingKeywords = ['tapaaminen', 'tapaamista', 'kokous', 'kokousta', 'meeting', 'aikaa', 'aikatalu', 'sopiiko', 'sopisko', 'ehdotan', 'milloin', 'kalenter', 'kutsu', 'iltapäiv', 'ajankoht']
    const hasMeetingRequest = meetingKeywords.some(k => subj.includes(k) || snippet.includes(k))

    let category

    if (!isIncoming) {
      category = 'Lähetetyt'
    } else if (e.userIsLatest) {
      category = null // Ei kategoriaa — näkyy vain "Kaikki"-näkymässä
    } else if (hasMeetingRequest) {
      category = 'Kalenteroi'
    } else if (isUnread) {
      category = 'Prioriteetti'
    } else {
      category = 'Muut'
    }

    return { ...e, category, hasMeetingRequest }
  })
}
