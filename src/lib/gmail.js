/**
 * Gmail API service
 *
 * Uses Google OAuth2 to fetch emails from the user's inbox.
 * In development, you'll need to:
 *
 * 1. Create a project at https://console.cloud.google.com
 * 2. Enable the Gmail API
 * 3. Create OAuth2 credentials (Web application)
 * 4. Set redirect URI to http://localhost:3000
 * 5. Add VITE_GOOGLE_CLIENT_ID to .env
 */

const SCOPES = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.readonly'

let tokenClient = null
let accessToken = null

export function isAuthenticated() {
  return !!accessToken
}

export function getAccessToken() {
  return accessToken
}

/**
 * Initialize Google Identity Services
 */
export function initGoogleAuth(clientId) {
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (response) => {
          if (response.access_token) {
            accessToken = response.access_token
          }
        },
      })
      resolve(true)
    }
    document.head.appendChild(script)
  })
}

/**
 * Trigger Google OAuth login
 */
export function signIn() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized'))
      return
    }
    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error))
        return
      }
      accessToken = response.access_token
      resolve(response.access_token)
    }
    tokenClient.requestAccessToken()
  })
}

/**
 * Move email to trash
 */
export async function trashEmail(emailId) {
  if (!accessToken) throw new Error('Not authenticated')
  const resp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/trash`,
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!resp.ok) throw new Error('Poistaminen epäonnistui')
}

/**
 * Toggle read/unread status
 */
export async function toggleReadStatus(emailId, markRead) {
  if (!accessToken) throw new Error('Not authenticated')
  const body = markRead
    ? { removeLabelIds: ['UNREAD'] }
    : { addLabelIds: ['UNREAD'] }
  const resp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
  if (!resp.ok) throw new Error('Tilan muutos epäonnistui')
}

/**
 * Fetch entire thread — all messages in order
 */
export async function fetchThread(threadId) {
  if (!accessToken) throw new Error('Not authenticated')

  const resp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!resp.ok) throw new Error('Viestiketjun haku epäonnistui')

  const thread = await resp.json()
  return (thread.messages || []).map(msg => {
    const headers = {}
    msg.payload.headers.forEach(h => { headers[h.name] = h.value })

    const fromRaw = headers.From || ''
    const fromMatch = fromRaw.match(/^"?([^"<]+)"?\s*<(.+)>$/)
    const fromName = fromMatch ? fromMatch[1].trim() : fromRaw
    const fromEmail = fromMatch ? fromMatch[2] : fromRaw
    const isSent = msg.labelIds?.includes('SENT')

    const date = new Date(parseInt(msg.internalDate))
    const dateStr = date.toLocaleDateString('fi-FI', {
      day: 'numeric', month: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    const body = extractBody(msg.payload)

    return {
      id: msg.id,
      from: fromName,
      email: fromEmail,
      date: dateStr,
      timestamp: parseInt(msg.internalDate),
      isSent,
      body,
    }
  }).sort((a, b) => a.timestamp - b.timestamp) // vanhimmasta uusimpaan
}

/**
 * Fetch full email body by message ID
 */
export async function fetchEmailBody(emailId) {
  if (!accessToken) throw new Error('Not authenticated')

  const resp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!resp.ok) throw new Error('Viestin haku epäonnistui')

  const msg = await resp.json()
  return extractBody(msg.payload)
}

function extractBody(payload) {
  // Direct body (simple messages)
  if (payload.body?.data) {
    return { html: decodeBase64(payload.body.data), text: '' }
  }

  // Multipart messages — look for html first, then plain text
  let html = ''
  let text = ''

  function walkParts(parts) {
    if (!parts) return
    for (const part of parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        html = decodeBase64(part.body.data)
      } else if (part.mimeType === 'text/plain' && part.body?.data) {
        text = decodeBase64(part.body.data)
      }
      if (part.parts) walkParts(part.parts)
    }
  }

  walkParts(payload.parts)
  return { html, text }
}

function decodeBase64(data) {
  try {
    return decodeURIComponent(
      atob(data.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
  } catch {
    return atob(data.replace(/-/g, '+').replace(/_/g, '/'))
  }
}

/**
 * Fetch recent emails from Gmail API
 */
export async function fetchEmails(maxResults = 10) {
  if (!accessToken) throw new Error('Not authenticated')

  // 1. Get message list (inbox only, excluding sent)
  const listResp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const listData = await listResp.json()

  if (!listData.messages) return []

  // 2. Fetch each message's details
  const emails = await Promise.all(
    listData.messages.map(async (msg) => {
      const resp = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      return resp.json()
    })
  )

  // 3. Parse into our format
  const parsed = emails.map((msg) => {
    const headers = {}
    msg.payload.headers.forEach((h) => {
      headers[h.name] = h.value
    })

    const fromRaw = headers.From || ''
    const fromMatch = fromRaw.match(/^"?([^"<]+)"?\s*<(.+)>$/)
    const fromName = fromMatch ? fromMatch[1].trim() : fromRaw
    const fromEmail = fromMatch ? fromMatch[2] : fromRaw

    const isSent = msg.labelIds?.includes('SENT')

    const date = new Date(parseInt(msg.internalDate))
    const dateStr = date.toLocaleDateString('fi-FI', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    return {
      id: msg.id,
      threadId: msg.threadId,
      from: fromName,
      email: fromEmail,
      subject: headers.Subject || '(ei otsikkoa)',
      snippet: msg.snippet || '',
      date: dateStr,
      timestamp: parseInt(msg.internalDate),
      direction: isSent ? 'out' : 'in',
      labels: msg.labelIds || [],
      hasReplied: false,
    }
  })

  // 4. Fetch user's recent sent messages to compare timestamps
  const sentResp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&labelIds=SENT`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const sentData = await sentResp.json()
  const sentMessages = sentData.messages || []

  // Fetch details of sent messages to get threadId + timestamp
  const sentDetails = await Promise.all(
    sentMessages.map(async (msg) => {
      try {
        const resp = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        const data = await resp.json()
        return { threadId: data.threadId, timestamp: parseInt(data.internalDate) }
      } catch {
        return null
      }
    })
  )

  // Build map: threadId → newest sent timestamp
  const sentByThread = {}
  for (const s of sentDetails.filter(Boolean)) {
    if (!sentByThread[s.threadId] || s.timestamp > sentByThread[s.threadId]) {
      sentByThread[s.threadId] = s.timestamp
    }
  }

  console.log(`Sent threads found: ${Object.keys(sentByThread).length} threads from ${sentDetails.filter(Boolean).length} sent messages`)

  // For each incoming email, check if user's sent message is newer
  return parsed.map(e => {
    if (!e.threadId || e.direction === 'out') return { ...e, userIsLatest: false }
    const sentTimestamp = sentByThread[e.threadId]
    const userIsLatest = sentTimestamp ? sentTimestamp > e.timestamp : false
    if (e.direction === 'in') {
      console.log(`${e.from}: threadId=${e.threadId}, emailTs=${e.timestamp}, sentTs=${sentTimestamp || 'none'}, userIsLatest=${userIsLatest}`)
    }
    return { ...e, userIsLatest }
  })
}

/**
 * Send a reply to an email thread via Gmail API
 */
export async function sendReply(email, body) {
  if (!accessToken) throw new Error('Not authenticated')

  const subject = email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`

  const rawMessage = [
    `To: ${email.email}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${email.id}`,
    `References: ${email.id}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n')

  const encoded = btoa(unescape(encodeURIComponent(rawMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const payload = { raw: encoded }
  if (email.threadId) {
    payload.threadId = email.threadId
  }

  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Lähetys epäonnistui')
  }

  return resp.json()
}

/**
 * Scheduled replies — stored in localStorage, sent via setTimeout
 */
const SCHEDULED_KEY = 'scheduled_replies'
const scheduledTimers = {}

function getScheduledReplies() {
  try {
    return JSON.parse(localStorage.getItem(SCHEDULED_KEY) || '[]')
  } catch {
    return []
  }
}

function saveScheduledReplies(replies) {
  localStorage.setItem(SCHEDULED_KEY, JSON.stringify(replies))
}

export function scheduleReply(email, body, sendAt) {
  const id = `sched_${Date.now()}`
  const entry = { id, email, body, sendAt: sendAt.getTime() }

  const replies = getScheduledReplies()
  replies.push(entry)
  saveScheduledReplies(replies)

  setScheduledTimer(entry)
  return id
}

function setScheduledTimer(entry) {
  const delay = entry.sendAt - Date.now()
  const fire = async () => {
    try {
      await sendReply(entry.email, entry.body)
    } catch (err) {
      console.error('Ajastettu lähetys epäonnistui:', err)
    }
    // Remove from localStorage
    const replies = getScheduledReplies().filter(r => r.id !== entry.id)
    saveScheduledReplies(replies)
    delete scheduledTimers[entry.id]
  }

  if (delay <= 0) {
    fire()
  } else {
    scheduledTimers[entry.id] = setTimeout(fire, delay)
  }
}

export function cancelScheduledReply(id) {
  if (scheduledTimers[id]) {
    clearTimeout(scheduledTimers[id])
    delete scheduledTimers[id]
  }
  const replies = getScheduledReplies().filter(r => r.id !== id)
  saveScheduledReplies(replies)
}

export function loadScheduledReplies() {
  const replies = getScheduledReplies()
  replies.forEach(entry => setScheduledTimer(entry))
  return replies
}

/**
 * Demo mode: returns sample emails for testing without Google Auth
 */
export function getDemoEmails() {
  return [
    { id: '1', from: 'Inkeri Mankkinen', email: 'inkeri@amerikka.fi', subject: 'Re: Lupaamani asiat + vapaat ajat', snippet: 'Moikka, Kiitos Anna! Pohdimme vielä, pitäisikö Severa-tuntikirjaus- ja kokousmuistio-teemat yhdistää...', date: '1.4.2026 07:49', timestamp: Date.now(), direction: 'in', labels: ['UNREAD', 'INBOX'] },
    { id: '8', from: 'PowerDMARC', email: 'noreply@app.powerdmarc.com', subject: 'PowerDMARC - Your Basic report is ready!', snippet: 'Here\'s your monthly basic report for March 2026', date: '1.4.2026 06:00', timestamp: Date.now() - 840000, direction: 'in', labels: ['INBOX', 'CATEGORY_UPDATES'] },
    { id: '9', from: 'MarkkinointiKollektiivi', email: 'hello@mkollektiivi.fi', subject: 'Kutsu markkinoinnin ja myynnin yhteiseen iltapäivään Ouluun ke 6.5.2026', snippet: 'Hei Anna, kutsumme sinut markkinoinnin ja myynnin yhteiseen iltapäivään...', date: '1.4.2026 05:29', timestamp: Date.now() - 960000, direction: 'in', labels: ['INBOX', 'CATEGORY_PROMOTIONS'] },
  ]
}
