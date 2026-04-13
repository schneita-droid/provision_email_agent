const CATEGORY_NAMES = ['Prioriteetti', 'Kalenteroi', 'Muut', 'Lähetetyt']

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  const { emails, corrections = [] } = req.body

  if (!emails || !Array.isArray(emails)) {
    return res.status(400).json({ error: 'emails array required' })
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
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await resp.json()

    if (!resp.ok) {
      console.error('Anthropic API error:', data)
      return res.status(resp.status).json({ error: 'Anthropic API error', details: data })
    }

    const text = data.content?.map((c) => c.text || '').join('') || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const cats = JSON.parse(clean)

    const result = emails.map((e, i) => {
      const item = cats[i]
      const category = typeof item === 'string' ? item : item?.category
      const hasMeetingRequest = typeof item === 'object' ? !!item?.hasMeetingRequest : false
      if (e.userIsLatest) {
        return { ...e, category: null, hasMeetingRequest }
      }
      return {
        ...e,
        category: CATEGORY_NAMES.includes(category) ? category : 'Muut',
        hasMeetingRequest,
      }
    })

    return res.status(200).json(result)
  } catch (err) {
    console.error('Categorization failed:', err)
    return res.status(500).json({ error: 'Categorization failed', message: err.message })
  }
}
