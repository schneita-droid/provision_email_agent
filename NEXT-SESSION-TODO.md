# Seuraava sessio — Email Dashboard

## HUOM: Google Cloud siirto
Anna haluaa siirtää Google Cloud -projektin pois henkilökohtaiselta tililtä toiseen tiliin (yritystili). Tämä pitää tehdä ENSIN ennen Vercel-deploya:
- Luo uusi Google Cloud -projekti uudella tilillä
- Ota käyttöön Gmail API + Google Calendar API
- Luo uudet OAuth 2.0 credentials
- Siirrä Client ID .env-tiedostoon
- Lisää testikäyttäjät (max 10 henkilöä)

## Vercel Deploy + Backend (kaikki yhdessä paketissa)

### 1. Backend API Routes
- Siirrä Anthropic API -kutsut palvelinpuolelle (Vercel Functions)
- Siirrä Gmail/Calendar API -kutsut palvelinpuolelle
- API-avaimet Vercelin ympäristömuuttujiin (ei näy selaimessa)

### 2. OAuth Token -persistenssi
- Token tallennetaan palvelinpuolelle (ei katoa sivun päivityksessä)
- Ei tarvitse klikata "Yhdistä Gmail" joka kerta

### 3. Käyttäjäkohtainen tallennus (5 henkilöä)
- Tietokanta (Vercel KV tai Supabase) per Google-tili
- Jokaisen oma tyyliohje
- Jokaisen omat kategoriakorjaukset
- Jokaisen lähetetyt viestit "esimerkkipankkiin" (AI oppii tyylistä)

### 4. AI-oppiminen lähetetyistä viesteistä
- Kun käyttäjä lähettää viestin dashboardista → tallenna se
- Seuraavissa draft-generoinneissa käytä 5-10 viimeisintä lähetettyä viestiä kontekstina
- Mitä enemmän käyttää, sitä paremmin AI kirjoittaa käyttäjän tyylillä

### 5. Whisper API (parempi suomen puheentunnistus)
- Vaihda Web Speech API → OpenAI Whisper API
- Nauhoita ääni selaimessa → lähetä backend-API:lle → Whisper transkriboi
- Paljon parempi suomenkielinen tunnistus
- Hinta: ~$0.006/minuutti

### 6. Hosting + Domain
- Vercel deploy (yhdistä GitHub repo)
- Oma domain (esim. mail.coccoagency.com)
- HTTPS automaattisesti

### 7. Ääkköset otsikossa (ongoing bug)
- Gmail API palauttaa subject-headerin mojibake-muodossa (VÃ¤ → Vä)
- Useita korjausyrityksiä tehty, ei vielä ratkaistu
- Kokeiltava: hae subject thread API:sta tai käytä Gmail batch API:a

## Projektin tila
- Koodi GitHubissa: https://github.com/schneita-droid/email-dashboard (private)
- Google Cloud: "My First Project" (Annan henkilökohtainen tili — SIIRRETTÄVÄ)
- OAuth: External, Testing-tila, 1 test user
- Anthropic API -avain .env-tiedostossa

## Tekniset tiedot
- React 18 + Vite 6
- Anthropic Claude Sonnet 4 (kategorisointi + draft-generointi)
- Gmail API (gmail.modify scope) + Google Calendar API (calendar.readonly)
- Web Speech API (vaihdetaan Whisperiin)
- PWA-valmis (manifest.json + service worker)
- Mobiiliresponsiivinen
