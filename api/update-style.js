export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  const { currentStyleGuide, recentMessages } = req.body

  if (!recentMessages || !Array.isArray(recentMessages) || recentMessages.length === 0) {
    return res.status(400).json({ error: 'recentMessages array required' })
  }

  const messagesText = recentMessages.map((m, i) =>
    `${i + 1}. Aihe: ${m.subject}\nVastaanottaja: ${m.recipient}\nViesti:\n${m.body}`
  ).join('\n\n---\n\n')

  const systemPrompt = `Olet kirjoitustyylianalysaattori. Tehtäväsi on analysoida käyttäjän lähettämiä sähköposteja ja luoda/päivittää kompakti tyyliohje.

Tyyliohje kuvaa käyttäjän kirjoitustyylin niin, että toinen AI voi kirjoittaa samalla tyylillä. Sisällytä:
- Tervehdystyyli (miten aloittaa viestit)
- Lopetustyyli (allekirjoitus, lopputervehdys)
- Sävy (muodollinen/epämuodollinen, lyhyt/pitkä)
- Tyypilliset ilmaisut ja sanavalinnat
- Mitä välttää (jos huomaat johdonmukaisia valintoja)

Ole tiivis — max 150 sanaa. Kirjoita suomeksi.`

  const userPrompt = currentStyleGuide
    ? `Nykyinen tyyliohje:\n${currentStyleGuide}\n\nKäyttäjän 10 viimeisintä sähköpostia:\n${messagesText}\n\nPäivitä tyyliohje näiden perusteella. Säilytä aiemmat havainnot ja lisää uudet.`
    : `Käyttäjän sähköposteja:\n${messagesText}\n\nLuo tyyliohje näiden perusteella.`

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
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const data = await resp.json()

    if (!resp.ok) {
      console.error('Anthropic API error:', data)
      return res.status(resp.status).json({ error: 'Style update failed', details: data })
    }

    const text = data.content?.map(c => c.text || '').join('') || ''
    return res.status(200).json({ styleGuide: text })
  } catch (err) {
    console.error('Style update failed:', err)
    return res.status(500).json({ error: 'Style update failed', message: err.message })
  }
}
