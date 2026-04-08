export const CATEGORIES = {
  'Prioriteetti': {
    color: 'var(--cat-respond)',
    bg: 'var(--cat-respond-bg)',
    text: 'var(--cat-respond-text)',
    order: 1,
    icon: '↩',
    description: 'Prioriteetti',
  },
  'Kalenteroi': {
    color: 'var(--cat-meeting)',
    bg: 'var(--cat-meeting-bg)',
    text: 'var(--cat-meeting-text)',
    order: 2,
    icon: '📅',
    description: 'Vaatii aikataulutusta',
  },
  'Muut': {
    color: 'var(--cat-notification)',
    bg: 'var(--cat-notification-bg)',
    text: 'var(--cat-notification-text)',
    order: 3,
    icon: '📌',
    description: 'Muut viestit',
  },
  'Lähetetyt': {
    color: 'var(--cat-sent)',
    bg: 'var(--cat-sent-bg)',
    text: 'var(--cat-sent-text)',
    order: 4,
    icon: '↗',
    description: 'Lähetetyt viestit',
  },
}

export const CATEGORY_NAMES = Object.keys(CATEGORIES)
