# Sähköpostien priorisointidashboard

AI-pohjainen sähköpostien kategorisointidashboard, joka lajittelee Gmail-viestit viiteen prioriteettiluokkaan:

1. **To Respond** — vaatii vastausta
2. **FYI** — tiedoksi
3. **Comment** — kommentti ketjussa
4. **Notification** — automaattinen ilmoitus
5. **Meeting Update** — kokouspäivitys

## Pikakäynnistys (demo-tila)

```bash
npm install
npm run dev
```

Avaa http://localhost:3000 — toimii heti demo-datalla ilman API-avaimia.

## Gmail-integraatio

1. Luo projekti osoitteessa https://console.cloud.google.com
2. Ota käyttöön Gmail API
3. Luo OAuth2-tunnukset (Web application)
4. Aseta redirect URI: `http://localhost:3000`
5. Kopioi `.env.example` → `.env` ja lisää `VITE_GOOGLE_CLIENT_ID`

## AI-kategorisointi

Oletuksena käytetään sääntöpohjaista kategorisointia. AI-kategorisointi vaatii Anthropic API -avaimen:

1. Hanki API-avain osoitteesta https://console.anthropic.com
2. Lisää `.env`-tiedostoon: `VITE_ANTHROPIC_API_KEY=sk-ant-...`

**Huom:** Tuotannossa API-kutsu tulee tehdä backend-palvelimen kautta, ei suoraan selaimesta.

## Projektin rakenne

```
src/
├── App.jsx                 # Pääkomponentti
├── main.jsx                # Entry point
├── components/
│   ├── SummaryCards.jsx     # Yhteenveto-kortit
│   ├── CategoryFilter.jsx   # Kategoria-suodattimet
│   ├── EmailCard.jsx        # Yksittäinen sähköpostikortti
│   └── EmailList.jsx        # Sähköpostilista
├── lib/
│   ├── categories.js        # Kategorioiden konfiguraatio
│   ├── categorize.js        # AI + sääntöpohjainen kategorisointi
│   └── gmail.js             # Gmail API + demo-data
└── styles/
    └── global.css           # Globaalit tyylit + dark mode
```

## Jatkokehitys Claude Codella

Avaa projekti Claude Codessa ja pyydä esimerkiksi:
- "Lisää backend Express-palvelimella API-avainten suojaamiseen"
- "Lisää drag & drop -mahdollisuus kategorioiden välille"
- "Lisää automaattinen päivitys 5 minuutin välein"
- "Deployaa Verceliin"
- "Lisää email-detaljinäkymä koko viestin lukemiseen"

## Tech stack

- **Vite** + **React 18**
- **Anthropic Claude API** (sähköpostien kategorisointi)
- **Google Gmail API** (sähköpostien haku)
- CSS Variables + dark mode
- DM Sans + Instrument Serif typografia
