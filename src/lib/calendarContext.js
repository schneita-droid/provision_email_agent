import { formatFreeSlotsText } from './calendar'

/**
 * Build calendar context string for AI prompts
 */
export function buildCalendarContext(freeSlots) {
  if (!freeSlots || !freeSlots.length) return ''

  const slotsText = formatFreeSlotsText(freeSlots)
  return `Käyttäjän vapaat ajat kalenterissa:\n${slotsText}`
}
