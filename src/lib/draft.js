export async function generateVoiceDraft(email, transcript, styleContext, calendarContext) {
  try {
    const resp = await fetch('/api/voice-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, transcript, styleContext, calendarContext }),
    })

    if (!resp.ok) {
      console.warn('Voice draft API failed, using fallback')
      return `Hei,\n\n${transcript}\n\nYstävällisin terveisin`
    }

    const data = await resp.json()
    return data.draft || ''
  } catch (err) {
    console.error('Voice draft generation failed:', err)
    return `Hei,\n\n${transcript}\n\nYstävällisin terveisin`
  }
}

export async function generateDraft(email, calendarContext, styleContext) {
  try {
    const resp = await fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, calendarContext, styleContext }),
    })

    if (!resp.ok) {
      console.warn('Draft API failed, using fallback')
      return `Hei,\n\nKiitos viestistäsi. Palaan asiaan pian.\n\nYstävällisin terveisin`
    }

    const data = await resp.json()
    return data.draft || ''
  } catch (err) {
    console.error('Draft generation failed:', err)
    return `Hei,\n\nKiitos viestistäsi. Palaan asiaan pian.\n\nYstävällisin terveisin`
  }
}
