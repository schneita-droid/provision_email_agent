const SAMPLES_KEY = 'sent_samples'
const COUNT_KEY = 'sent_count'
const MAX_STORED = 50

/**
 * Save a sent email sample to localStorage.
 * Stores subject, recipient, body (max 500 chars), and timestamp.
 */
export function saveSentSample(email, body) {
  const samples = getAllSentSamples()
  samples.push({
    subject: email.subject || '',
    recipient: `${email.from} <${email.email}>`,
    body: (body || '').slice(0, 500),
    sentAt: Date.now(),
  })

  // Keep only the most recent MAX_STORED
  if (samples.length > MAX_STORED) {
    samples.splice(0, samples.length - MAX_STORED)
  }

  localStorage.setItem(SAMPLES_KEY, JSON.stringify(samples))

  // Increment total sent count
  const count = getSentCount() + 1
  localStorage.setItem(COUNT_KEY, String(count))

  return count
}

/**
 * Get the N most recent sent samples.
 */
export function getSentSamples(count = 3) {
  const samples = getAllSentSamples()
  return samples.slice(-count)
}

/**
 * Get all stored sent samples.
 */
export function getAllSentSamples() {
  try {
    return JSON.parse(localStorage.getItem(SAMPLES_KEY) || '[]')
  } catch {
    return []
  }
}

/**
 * Get total number of messages sent (lifetime counter).
 */
export function getSentCount() {
  return parseInt(localStorage.getItem(COUNT_KEY) || '0', 10)
}

/**
 * Check if it's time to update the style guide (every 10 messages).
 */
export function shouldUpdateStyleGuide(count) {
  return count > 0 && count % 10 === 0
}
