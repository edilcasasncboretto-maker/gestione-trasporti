// Invocata dal pulsante "Invia email di prova" nella pagina Notifiche.
// Per evitare abusi (chiunque trovasse l'URL potrebbe far inviare email a ripetizione),
// il destinatario non viene mai preso dalla richiesta del browser: si legge sempre
// e solo l'indirizzo salvato in Firestore dall'ufficio.

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function db() {
  if (getApps().length === 0) {
    const credenziali = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    initializeApp({ credential: cert(credenziali) })
  }
  return getFirestore()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ errore: 'Metodo non consentito' })

  try {
    const firestore = db()
    const impostazioniSnap = await firestore.doc('impostazioni/notifiche').get()
    const impostazioni = impostazioniSnap.exists ? impostazioniSnap.data() : null
    if (!impostazioni?.email) {
      return res.status(400).json({ errore: 'Nessun indirizzo email salvato nelle impostazioni' })
    }

    const risposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Gestione Trasporti <onboarding@resend.dev>',
        to: [impostazioni.email],
        subject: 'Email di prova — Gestione Trasporti',
        html: '<p>Questa è una email di prova: se la ricevi, la configurazione delle notifiche funziona correttamente.</p>',
      }),
    })

    if (!risposta.ok) {
      const dettaglio = await risposta.text()
      return res.status(500).json({ errore: 'Invio fallito: ' + dettaglio })
    }

    return res.status(200).json({ messaggio: 'Email di prova inviata a ' + impostazioni.email })
  } catch (errore) {
    console.error(errore)
    return res.status(500).json({ errore: errore.message })
  }
}
