import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  // Check if KV is configured
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(501).json({ error: 'Vercel KV not configured — using localStorage fallback' })
  }

  const VALID_KEYS = [
    'sent_samples',
    'sent_count',
    'email_writing_style',
    'email_auto_style_guide',
    'prioritized_corrections',
  ]

  if (req.method === 'GET') {
    const { email, key } = req.query

    if (!email || !key) {
      return res.status(400).json({ error: 'email and key params required' })
    }
    if (!VALID_KEYS.includes(key)) {
      return res.status(400).json({ error: `Invalid key. Valid keys: ${VALID_KEYS.join(', ')}` })
    }

    try {
      const value = await kv.get(`user:${email}:${key}`)
      return res.status(200).json({ value: value ?? null })
    } catch (err) {
      console.error('KV read error:', err)
      return res.status(500).json({ error: 'KV read failed' })
    }
  }

  if (req.method === 'POST') {
    const { email, key, value } = req.body

    if (!email || !key) {
      return res.status(400).json({ error: 'email and key required' })
    }
    if (!VALID_KEYS.includes(key)) {
      return res.status(400).json({ error: `Invalid key. Valid keys: ${VALID_KEYS.join(', ')}` })
    }

    try {
      await kv.set(`user:${email}:${key}`, value)
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('KV write error:', err)
      return res.status(500).json({ error: 'KV write failed' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
