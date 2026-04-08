export async function generateVoiceDraft(email, transcript, styleContext, calendarContext) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

  if (!apiKey) {
    return `Hei,\n\n${transcript}\n\nYstävällisin terveisin`
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
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  const data = await resp.json()
  return data.content?.map(c => c.text || '').join('') || ''
}

export async function generateDraft(email, calendarContext, styleContext) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

  if (!apiKey) {
    return `Hei,\n\nKiitos viestistäsi. Palaan asiaan pian.\n\nYstävällisin terveisin`
  }

  const systemPrompt = `Olet sähköpostivastausten kirjoittaja. Kirjoita viimeistelty sähköpostivastaus suomeksi.

TÄRKEÄÄ: Kirjoita luonnollista, sujuvaa suomea. Älä käännä englannista. Kirjoita kuin suomalainen kirjoittaisi.

Noudata EHDOTTOMASTI käyttäjän kirjoitustyyliohjeita. Ne ovat pakollisia sääntöjä, eivät ehdotuksia. Tämä koskee myös allekirjoitusta, sävyä, kiellettyjä ilmaisuja ja muotoilua. Jos tyyliohjeissa on allekirjoitus, käytä sitä AINA sellaisenaan viestin lopussa.

${styleContext || ''}

${calendarContext ? `${calendarContext}\n\nJos sähköpostissa puhutaan aikatauluista, ehdota konkreettisia vapaita aikoja.` : ''}`

  const userPrompt = `Alkuperäinen sähköposti:
Lähettäjä: ${email.from} <${email.email}>
Aihe: ${email.subject}
Viesti: ${email.snippet}

Kirjoita viimeistelty sähköpostivastaus. Aloita sopivalla tervehdyksellä. Älä lisää aiheriviä.`

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
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  const data = await resp.json()
  return data.content?.map(c => c.text || '').join('') || ''
}
