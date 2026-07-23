// Funzione serverless (non fa parte del sito React: gira su Vercel come
// piccolo programma a sé, invocata automaticamente una volta al giorno da
// Vercel Cron — vedi "crons" in vercel.json).
//
// Ogni giorno: legge le scadenze del mezzo da Firestore, confronta i giorni
// rimanenti con le soglie impostate dall'ufficio nella pagina "Notifiche",
// e se una scadenza è arrivata esattamente a una di quelle soglie invia
// un'email riepilogativa tramite Resend. Ogni avviso viene inviato una sola
// volta (viene ricordato in Firestore), così non si ricevono email ripetute.

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const ETICHETTE = {
  assicurazione: 'Assicurazione',
  bollo: 'Bollo',
  revisione_mezzo: 'Revisione mezzo',
  revisione_gru: 'Revisione gru',
}

function db() {
  if (getApps().length === 0) {
    const credenziali = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    initializeApp({ credential: cert(credenziali) })
  }
  return getFirestore()
}

function giorniRimanenti(dataISO, oggiISO) {
  const unGiorno = 24 * 60 * 60 * 1000
  return Math.round((new Date(dataISO) - new Date(oggiISO)) / unGiorno)
}

async function inviaEmail(destinatario, oggetto, html) {
  const risposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Gestione Trasporti <onboarding@resend.dev>',
      to: [destinatario],
      subject: oggetto,
      html,
    }),
  })
  if (!risposta.ok) {
    throw new Error('Invio email fallito: ' + (await risposta.text()))
  }
}

export default async function handler(req, res) {
  // Sicurezza: Vercel Cron invia automaticamente questo header se imposti
  // la variabile d'ambiente CRON_SECRET — impedisce che chiunque trovi
  // l'URL e forzi l'invio di email a piacimento.
  if (process.env.CRON_SECRET) {
    const autorizzazione = req.headers['authorization']
    if (autorizzazione !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ errore: 'Non autorizzato' })
    }
  }

  try {
    const firestore = db()

    const impostazioniSnap = await firestore.doc('impostazioni/notifiche').get()
    const impostazioni = impostazioniSnap.exists ? impostazioniSnap.data() : null
    if (!impostazioni?.attivo || !impostazioni?.email) {
      return res.status(200).json({ messaggio: 'Notifiche disattivate o email non configurata' })
    }

    const soglie = impostazioni.soglieGiorni?.length ? impostazioni.soglieGiorni : [30, 14, 7, 3, 1, 0]

    const mezzoSnap = await firestore.doc('mezzo/principale').get()
    const mezzo = mezzoSnap.exists ? mezzoSnap.data() : null
    if (!mezzo?.scadenze) {
      return res.status(200).json({ messaggio: 'Nessuna scadenza configurata sul mezzo' })
    }

    const oggi = new Date().toISOString().slice(0, 10)
    const notificheGiaInviate = mezzo.notificheInviate || {}
    const daInviare = []

    for (const [tipo, dettaglio] of Object.entries(mezzo.scadenze)) {
      if (!dettaglio?.data) continue
      const giorni = giorniRimanenti(dettaglio.data, oggi)
      if (!soglie.includes(giorni)) continue
      const chiave = `${tipo}_${dettaglio.data}_${giorni}`
      if (notificheGiaInviate[chiave]) continue
      daInviare.push({ tipo, dettaglio, giorni, chiave })
    }

    if (daInviare.length === 0) {
      return res.status(200).json({ messaggio: 'Nessuna scadenza in soglia oggi' })
    }

    const righe = daInviare
      .map(({ tipo, dettaglio, giorni }) => {
        const quando = giorni === 0 ? 'scade oggi' : giorni < 0 ? `scaduta da ${Math.abs(giorni)} giorni` : `tra ${giorni} giorni`
        return `<li><strong>${ETICHETTE[tipo] || tipo}</strong> — ${quando} (${dettaglio.data})${dettaglio.costo ? `, costo previsto ${dettaglio.costo} €` : ''}</li>`
      })
      .join('')

    await inviaEmail(
      impostazioni.email,
      `Scadenze mezzo da controllare (${daInviare.length})`,
      `<p>Promemoria automatico dalla Gestione Trasporti:</p><ul>${righe}</ul>`
    )

    const aggiornamento = { notificheInviate: { ...notificheGiaInviate } }
    daInviare.forEach(({ chiave }) => { aggiornamento.notificheInviate[chiave] = true })
    await firestore.doc('mezzo/principale').set(aggiornamento, { merge: true })

    return res.status(200).json({ messaggio: `Email inviata con ${daInviare.length} scadenze` })
  } catch (errore) {
    console.error(errore)
    return res.status(500).json({ errore: errore.message })
  }
}
