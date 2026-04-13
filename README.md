# Sähköpostien priorisointidashboard

AI-pohjainen sähköpostidashboard, joka lajittelee Gmail-viestit neljään kategoriaan, generoi vastausluonnoksia ja oppii kirjoitustyylistäsi ajan myötä.

**Kategoriat:** Prioriteetti (vaatii vastausta) · Kalenteroi (aikataulutus) · Muut (tiedoksi) · Lähetetyt

## Ominaisuudet

- **AI-kategorisointi** — Claude Sonnet lajittelee sähköpostit automaattisesti
- **Vastausluonnokset** — AI kirjoittaa vastaukset puolestasi, tyyliäsi noudattaen
- **Ääni-input** — sanele vastaus mikrofonilla (Web Speech API)
- **Kalenterituki** — näyttää vapaat ajat Google Calendarista, ehdottaa tapaamisaikoja
- **AI-oppiminen** — tallentaa lähettämäsi viestit ja oppii tyylistäsi joka viestillä
- **Mobiiliresponsiivinen** — toimii puhelimella ja tabletilla
- **PWA-valmis** — asentuu kotinäytölle

## Pikakäynnistys

### 1. Kloonaa ja asenna

```bash
git clone https://github.com/schneita-droid/email-dashboard.git
cd email-dashboard
npm install
```

### 2. Kopioi ympäristömuuttujat

```bash
cp .env.example .env
```

### 3. Lisää API-avaimet .env-tiedostoon

```env
# Pakollinen AI-ominaisuuksille (kategorisointi, draftit, tyylioppiminen)
# Hanki: https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...

# Valinnainen — Gmail-integraatio (ilman tätä toimii demo-datalla)
# Katso "Google Cloud setup" alla
VITE_GOOGLE_CLIENT_ID=123456789-xxx.apps.googleusercontent.com
```

### 4. Käynnistä

**Vaihtoehto A — Vercel dev (suositeltu, backend + frontend):**
```bash
npx vercel login   # kerran, luo ilmainen tili
npm run dev
```

**Vaihtoehto B — Pelkkä Vite (vain demo-tila, ei AI-ominaisuuksia):**
```bash
npx vite
```

Avaa http://localhost:3000 (tai portti jonka terminaali näyttää).

## Google Cloud setup (Gmail-integraatio)

Tarvitset Google Cloud -projektin Gmail- ja Calendar-integrointiin:

1. Mene [console.cloud.google.com](https://console.cloud.google.com)
2. Luo uusi projekti
3. Ota käyttöön:
   - **Gmail API** (APIs & Services → Library → "Gmail API" → Enable)
   - **Google Calendar API** (sama → "Google Calendar API" → Enable)
4. **OAuth consent screen:**
   - User Type: External
   - App name: Email Dashboard
   - Scopes: `gmail.modify`, `calendar.readonly`
   - Lisää itsesi testikäyttäjäksi (Testing-tilassa max 10 käyttäjää)
5. **Credentials:**
   - Create Credentials → OAuth client ID → Web application
   - Authorized JavaScript origins: `http://localhost:3000`
   - Kopioi Client ID → `.env` → `VITE_GOOGLE_CLIENT_ID`

## Projektin rakenne

```
email-dashboard/
├── api/                         # Vercel serverless functions (backend)
│   ├── categorize.js            # AI-kategorisointi
│   ├── draft.js                 # Vastausluonnos
│   ├── voice-draft.js           # Ääniluonnos
│   └── update-style.js          # Tyyliohjeen automaattipäivitys
├── src/
│   ├── App.jsx                  # Pääkomponentti
│   ├── main.jsx                 # Entry point
│   ├── components/
│   │   ├── EmailCard.jsx        # Sähköpostikortti + draft UI
│   │   ├── EmailList.jsx        # Sähköpostilista
│   │   ├── CategoryFilter.jsx   # Kategoria-suodattimet
│   │   ├── SummaryCards.jsx     # Yhteenveto-kortit
│   │   └── StyleSettings.jsx    # Tyyliasetusten UI
│   ├── lib/
│   │   ├── gmail.js             # Gmail API + demo-data
│   │   ├── calendar.js          # Google Calendar API
│   │   ├── calendarContext.js   # Kalenterikonteksti promptille
│   │   ├── categorize.js        # Kategorisointi (client → /api/categorize)
│   │   ├── categories.js        # Kategorioiden konfiguraatio
│   │   ├── draft.js             # Draft-generointi (client → /api/draft)
│   │   ├── styleContext.js      # Tyyliohjeen kokoaminen promptille
│   │   └── sentStore.js         # Lähetettyjen viestien tallennus + oppiminen
│   └── styles/
│       └── global.css           # Tyylit + dark mode
├── public/                      # PWA-tiedostot (manifest, icons, service worker)
├── vercel.json                  # Vercel-konfiguraatio
├── .env.example                 # Ympäristömuuttujapohja
└── package.json
```

## Arkkitehtuuri

### API-avainten suojaus
Anthropic API -avain ei koskaan näy selaimessa. Kaikki AI-kutsut menevät Vercel Functionsin kautta:

```
Selain → /api/categorize → Anthropic API
Selain → /api/draft → Anthropic API
Selain → /api/voice-draft → Anthropic API
Selain → /api/update-style → Anthropic API
```

Gmail- ja Calendar-kutsut menevät suoraan selaimesta Google API:in OAuth-tokenilla.

### AI-oppiminen

Dashboard oppii kirjoitustyylistäsi kahdella tasolla:

1. **Tuoreet esimerkit** — 3 viimeisintä lähettämääsi viestiä sisällytetään aina draft-promptiin
2. **Pysyvä tyyliopas** — joka 10. viestin jälkeen AI analysoi viestejäsi ja päivittää kompaktin tyyliohjeen automaattisesti

Data tallennetaan selaimen localStorageen → jokaisen käyttäjän tyyli on täysin erillinen.

## Tech stack

- **React 18** + **Vite 6**
- **Anthropic Claude Sonnet 4** (kategorisointi, draftit, tyylianalyysi)
- **Vercel Functions** (serverless backend)
- **Gmail API** (gmail.modify) + **Google Calendar API** (calendar.readonly)
- **Web Speech API** (ääni-input)
- CSS Variables + dark mode
- PWA (manifest.json + service worker)
