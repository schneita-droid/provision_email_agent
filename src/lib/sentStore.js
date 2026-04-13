import { loadUserData, saveUserData } from './userStore'

const SAMPLES_KEY = 'sent_samples'
const COUNT_KEY = 'sent_count'
const MAX_STORED = 50

/**
 * Save a sent email sample. Stores per-user via Vercel KV (or localStorage fallback).
 * Returns the new total sent count.
 */
export async function saveSentSample(email, body) {
  const samples = await getAllSentSamples()
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

  await saveUserData(SAMPLES_KEY, samples)

  // Increment total sent count
  const count = (await getSentCount()) + 1
  await saveUserData(COUNT_KEY, count)

  return count
}

/**
 * Get the N most recent sent samples.
 */
export async function getSentSamples(count = 3) {
  const samples = await getAllSentSamples()
  return samples.slice(-count)
}

/**
 * Get all stored sent samples.
 */
export async function getAllSentSamples() {
  const data = await loadUserData(SAMPLES_KEY)
  return Array.isArray(data) ? data : []
}

/**
 * Get total number of messages sent (lifetime counter).
 */
export async function getSentCount() {
  const count = await loadUserData(COUNT_KEY)
  return typeof count === 'number' ? count : 0
}

/**
 * Check if it's time to update the style guide (every 10 messages).
 */
export function shouldUpdateStyleGuide(count) {
  return count > 0 && count % 10 === 0
}
