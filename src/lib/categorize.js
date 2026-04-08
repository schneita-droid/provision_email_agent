import { CATEGORY_NAMES } from './categories'

/**
 * Categorize emails using Claude API.
 */
export async function categorizeEmails(emails, corrections = []) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

  if (!apiKey) {
    console.warn('No ANTHROPIC_API_KEY set — falling back to rule-based categorization')
    return categorizeWithRules(emails)
  }

  const correctionContext = corrections.length > 0
    ? `\nKäyttäjä on aiemmin korjannut näitä kategorisointeja — opi niistä:\n${corrections.map(c => `- "${c.subject}" lähettäjältä ${c.from}: oli "${c.originalCategory}", oikea on "${c.correctedCategory}"`).join('\n')}\n`
    : ''

  const prompt = `Olet sähköpostien lajitteluassistentti. Kategorisoi jokainen sähköposti yhteen kolmesta kategoriasta.

Kategoriat:
- "Prioriteetti": Saapuneet sähköpostit jotka vaativat vastausta JA joissa käyttäjä EI ole viimeisin vastaaja. Jos "Käyttäjä viimeisin: kyllä", palauta category: null
- "Kalenteroi": Sähköpostit jotka liittyvät aikataulutukseen (kokouskutsut, tapaamisehdotukset, kalenteripäivitykset, aikaehdotukset)
- "Lähetetyt": Käyttäjän itse lähettämät viestit (direction: out)
- "Muut": Kaikki muu (tiedoksi, ilmoitukset, uutiskirjeet, automaattiviestit)
${correctionContext}
Sähköpostit:
${emails.map((e, i) => `${i}. Lähettäjä: ${e.from} <${e.email}>, Aihe: "${e.subject}", Suunta: ${e.direction}, Labels: [${e.labels.join(',')}], Käyttäjä viimeisin: ${e.userIsLatest ? 'kyllä' : 'ei'}, Katkelma: "${e.snippet.substring(0, 100)}"`).join('\n')}

Vastaa VAIN JSON-taulukolla objekteja. Jokaisella on "category" (string) ja "hasMeetingRequest" (boolean — true jos viestissä on kokouspyyntö tai aikaehdotus).
Esimerkki: [{"category":"Prioriteetti","hasMeetingRequest":false},{"category":"Kalenteroi","hasMeetingRequest":true}]`

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await resp.json()
    const text = data.content?.map((c) => c.text || '').join('') || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const cats = JSON.parse(clean)

    return emails.map((e, i) => {
      const item = cats[i]
      const category = typeof item === 'string' ? item : item?.category
      const hasMeetingRequest = typeof item === 'object' ? !!item?.hasMeetingRequest : false
      // Override: if user is the latest in thread, no category
      if (e.userIsLatest) {
        return { ...e, category: null, hasMeetingRequest }
      }
      return {
        ...e,
        category: CATEGORY_NAMES.includes(category) ? category : 'Muut',
        hasMeetingRequest,
      }
    })
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
