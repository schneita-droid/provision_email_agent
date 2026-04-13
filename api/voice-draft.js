export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  const { email, transcript, styleContext, calendarContext } = req.body

  if (!email || !transcript) {
    return res.status(400).json({ error: 'email object and transcript required' })
  }

  const systemPrompt = `Olet sähköpostivastausten kirjoittaja. Muotoile käyttäjän sanelusta viimeistelty sähköpostivastaus suomeksi.

TÄRKEÄÄ: Kirjoita luonnollista, sujuvaa suomea. Älä käännä englannista. Kirjoita kuin suomalainen kirjoittaisi.

Noudata EHDOTTOMASTI käyttäjän kirjoitustyyliohjeita. Ne ovat pakollisia sääntöjä, eivät ehdotuksia. Tämä koskee myös allekirjoitusta, sävyä, kiellettyjä ilmaisuja ja muotoilua. Jos tyyliohjeissa on allekirjoitus, käytä sitä AINA sellaisenaan viestin lopussa.

${styleContext || ''}

${calendarContext ? `${calendarContext}\n\nJos käyttäjä haluaa ehdottaa tapaamista tai sähköpostissa puhutaan aikatauluista, käytä näitä vapaita aikoja vastauksessa. Ehdota konkreettisia aikoja.` : ''}`

  const userPrompt = `Alkuperäinen sähköposti:
Lähettäjä: ${email.from} <${email.email}>
Aihe: ${email.subject}
Viesti: ${email.snippet}

Käyttäjän sanelu: "${transcript}"

Kirjoita viimeistelty sähköpostivastaus. Aloita sopivalla tervehdyksellä. Älä lisää aiheriviä.`

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
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const data = await resp.json()

    if (!resp.ok) {
      console.error('Anthropic API error:', data)
      return res.status(resp.status).json({ error: 'Anthropic API error', details: data })
    }

    const text = data.content?.map(c => c.text || '').join('') || ''
    return res.status(200).json({ draft: text })
  } catch (err) {
    console.error('Voice draft generation failed:', err)
    return res.status(500).json({ error: 'Voice draft generation failed', message: err.message })
  }
}
