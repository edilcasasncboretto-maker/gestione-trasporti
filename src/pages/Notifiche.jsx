import { useEffect, useState } from 'react'
import { ascoltaImpostazioniNotifiche, salvaImpostazioniNotifiche } from '../services/firestore'

const vuoto = { email: '', soglieGiorni: [30, 14, 7, 3, 1, 0], attivo: true }

export default function Notifiche() {
  const [form, setForm] = useState(vuoto)
  const [testoSoglie, setTestoSoglie] = useState('30, 14, 7, 3, 1, 0')
  const [salvataggio, setSalvataggio] = useState(false)
  const [messaggio, setMessaggio] = useState(null)
  const [invioProva, setInvioProva] = useState(false)
  const [esitoProva, setEsitoProva] = useState(null)

  useEffect(() => ascoltaImpostazioniNotifiche((i) => {
    if (i) {
      setForm({ email: i.email || '', soglieGiorni: i.soglieGiorni || vuoto.soglieGiorni, attivo: i.attivo ?? true })
      setTestoSoglie((i.soglieGiorni || vuoto.soglieGiorni).join(', '))
    }
  }), [])

  async function salva(e) {
    e.preventDefault()
    setSalvataggio(true)
    setMessaggio(null)
    const soglieGiorni = testoSoglie
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n))
    await salvaImpostazioniNotifiche({ email: form.email, attivo: form.attivo, soglieGiorni })
    setSalvataggio(false)
    setMessaggio('Impostazioni salvate.')
  }

  async function inviaProva() {
    setInvioProva(true)
    setEsitoProva(null)
    try {
      const res = await fetch('/api/test-email', { method: 'POST' })
      const dati = await res.json()
      if (!res.ok) throw new Error(dati.errore || 'Errore sconosciuto')
      setEsitoProva({ ok: true, testo: dati.messaggio })
    } catch (e) {
      setEsitoProva({ ok: false, testo: e.message })
    } finally {
      setInvioProva(false)
    }
  }

  return (
    <div>
      <h1>Notifiche scadenze via email</h1>
      <p style={{ color: 'var(--nebbia-400)', marginTop: -8, marginBottom: 20 }}>
        Un controllo automatico gira una volta al giorno: se una scadenza del mezzo (assicurazione,
        bollo, revisioni) raggiunge esattamente uno dei giorni di anticipo indicati qui sotto, ricevi
        un'email di avviso all'indirizzo scelto. Ogni avviso arriva una sola volta.
      </p>

      <form onSubmit={salva} className="card" style={{ marginBottom: 24 }}>
        <div className="campo">
          <label>Email a cui ricevere gli avvisi</label>
          <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required
            placeholder="ufficio@azienda.it" />
        </div>

        <div className="campo">
          <label>Giorni di anticipo (separati da virgola)</label>
          <input value={testoSoglie} onChange={(e) => setTestoSoglie(e.target.value)} placeholder="30, 14, 7, 3, 1, 0" />
          <p style={{ fontSize: 12, color: 'var(--nebbia-400)', marginTop: 4 }}>
            Es. "30, 7, 1" = un avviso quando mancano 30 giorni, uno quando ne mancano 7, uno il giorno prima.
            Usa "0" per ricevere un avviso anche il giorno stesso della scadenza.
          </p>
        </div>

        <div className="campo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={form.attivo}
            onChange={(e) => setForm((f) => ({ ...f, attivo: e.target.checked }))} id="attivo" />
          <label htmlFor="attivo" style={{ marginBottom: 0 }}>Notifiche attive</label>
        </div>

        {messaggio && <p style={{ color: 'var(--verde-deposito)' }}>{messaggio}</p>}

        <button type="submit" className="btn-primario" disabled={salvataggio}>
          {salvataggio ? 'Salvataggio…' : 'Salva impostazioni'}
        </button>
      </form>

      <div className="card">
        <h2>Verifica configurazione</h2>
        <p style={{ color: 'var(--nebbia-400)' }}>
          Salva prima l'email qui sopra, poi invia un'email di prova per controllare che Resend sia
          configurato correttamente su Vercel.
        </p>
        <button type="button" className="btn-secondario" onClick={inviaProva} disabled={invioProva || !form.email}>
          {invioProva ? 'Invio in corso…' : 'Invia email di prova'}
        </button>
        {esitoProva && (
          <p style={{ marginTop: 10, color: esitoProva.ok ? 'var(--verde-deposito)' : 'var(--rosso-scadenza)' }}>
            {esitoProva.testo}
          </p>
        )}
      </div>
    </div>
  )
}
