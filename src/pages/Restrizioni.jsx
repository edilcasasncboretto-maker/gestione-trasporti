import { useEffect, useState } from 'react'
import {
  ascoltaRestrizioni, aggiornaRestrizione, creaRestrizione, eliminaRestrizione,
  ascoltaIndisponibilita, creaIndisponibilita, eliminaIndisponibilita,
} from '../services/firestore'

const GIORNI = [
  { chiave: 'lun', etichetta: 'Lun' }, { chiave: 'mar', etichetta: 'Mar' },
  { chiave: 'mer', etichetta: 'Mer' }, { chiave: 'gio', etichetta: 'Gio' },
  { chiave: 'ven', etichetta: 'Ven' }, { chiave: 'sab', etichetta: 'Sab' },
  { chiave: 'dom', etichetta: 'Dom' },
]

const vuoto = { zona: '', giorni: [], oraInizio: '08:00', oraFine: '20:00', sogliaQuintali: 75, note: '' }
const vuotoIndisponibilita = { motivo: '', dataInizio: '', oraInizio: '00:00', dataFine: '', oraFine: '23:59', note: '' }

export default function Restrizioni() {
  const [elenco, setElenco] = useState([])
  const [form, setForm] = useState(vuoto)
  const [idInModifica, setIdInModifica] = useState(null)
  const [salvataggio, setSalvataggio] = useState(false)

  const [indisponibilita, setIndisponibilita] = useState([])
  const [formIndisponibilita, setFormIndisponibilita] = useState(vuotoIndisponibilita)
  const [salvataggioIndisponibilita, setSalvataggioIndisponibilita] = useState(false)

  useEffect(() => ascoltaRestrizioni(setElenco), [])
  useEffect(() => ascoltaIndisponibilita(setIndisponibilita), [])

  function campo(chiave, valore) {
    setForm((f) => ({ ...f, [chiave]: valore }))
  }

  function toggleGiorno(chiave) {
    setForm((f) => ({
      ...f,
      giorni: f.giorni.includes(chiave) ? f.giorni.filter((g) => g !== chiave) : [...f.giorni, chiave],
    }))
  }

  function modifica(r) {
    setIdInModifica(r.id)
    setForm({ zona: r.zona, giorni: r.giorni || [], oraInizio: r.oraInizio, oraFine: r.oraFine, sogliaQuintali: r.sogliaQuintali, note: r.note || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function annulla() {
    setIdInModifica(null)
    setForm(vuoto)
  }

  async function salva(e) {
    e.preventDefault()
    setSalvataggio(true)
    const dati = { ...form, sogliaQuintali: parseFloat(form.sogliaQuintali) || 0 }
    if (idInModifica) await aggiornaRestrizione(idInModifica, dati)
    else await creaRestrizione(dati)
    setSalvataggio(false)
    annulla()
  }

  async function elimina(id) {
    if (confirm('Eliminare questo divieto?')) await eliminaRestrizione(id)
  }

  function campoIndisponibilita(chiave, valore) {
    setFormIndisponibilita((f) => ({ ...f, [chiave]: valore }))
  }

  async function salvaIndisponibilita(e) {
    e.preventDefault()
    if (!formIndisponibilita.dataFine) {
      campoIndisponibilita('dataFine', formIndisponibilita.dataInizio)
    }
    setSalvataggioIndisponibilita(true)
    await creaIndisponibilita({
      ...formIndisponibilita,
      dataFine: formIndisponibilita.dataFine || formIndisponibilita.dataInizio,
    })
    setSalvataggioIndisponibilita(false)
    setFormIndisponibilita(vuotoIndisponibilita)
  }

  async function eliminaIndisp(id) {
    if (confirm('Eliminare questo blocco di indisponibilità?')) await eliminaIndisponibilita(id)
  }

  return (
    <div>
      <h1>Divieti di transito mezzi pesanti</h1>
      <p style={{ color: 'var(--nebbia-400)', marginTop: -8, marginBottom: 20 }}>
        Inserisci qui i divieti che conosci per le zone in cui transiti abitualmente (centri storici,
        ZTL, ponti con limite di peso...). Non esiste una fonte unica automatica per l'Italia — queste
        regole, una volta salvate, compaiono come fasce colorate nel calendario così le vedi subito
        quando pianifichi una consegna.
      </p>

      <form onSubmit={salva} className="card" style={{ marginBottom: 24 }}>
        <h2>{idInModifica ? 'Modifica divieto' : 'Nuovo divieto'}</h2>
        <div className="campo">
          <label>Zona / Comune</label>
          <input value={form.zona} onChange={(e) => campo('zona', e.target.value)} required
            placeholder="Es. Centro storico Bergamo" />
        </div>

        <div className="campo">
          <label>Giorni in cui vale</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {GIORNI.map((g) => (
              <button
                type="button"
                key={g.chiave}
                onClick={() => toggleGiorno(g.chiave)}
                className={form.giorni.includes(g.chiave) ? 'btn-segnale' : 'btn-secondario'}
                style={{ padding: '6px 12px' }}
              >
                {g.etichetta}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div className="campo">
            <label>Dalle</label>
            <input type="time" value={form.oraInizio} onChange={(e) => campo('oraInizio', e.target.value)} />
          </div>
          <div className="campo">
            <label>Alle</label>
            <input type="time" value={form.oraFine} onChange={(e) => campo('oraFine', e.target.value)} />
          </div>
          <div className="campo">
            <label>Vietato oltre (quintali)</label>
            <input type="number" value={form.sogliaQuintali} onChange={(e) => campo('sogliaQuintali', e.target.value)} />
          </div>
        </div>

        <div className="campo">
          <label>Note (es. deroghe, riferimento ordinanza)</label>
          <textarea rows={2} value={form.note} onChange={(e) => campo('note', e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" className="btn-primario" disabled={salvataggio}>
            {salvataggio ? 'Salvataggio…' : idInModifica ? 'Salva modifiche' : 'Aggiungi divieto'}
          </button>
          {idInModifica && <button type="button" className="btn-secondario" onClick={annulla}>Annulla</button>}
        </div>
      </form>

      <div className="card">
        <h2>Divieti salvati ({elenco.length})</h2>
        {elenco.length === 0 && <p>Nessun divieto inserito.</p>}
        {elenco.map((r) => (
          <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--nebbia-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{r.zona}</strong> — oltre {r.sogliaQuintali} q.li, {(r.giorni || []).join(', ')} {r.oraInizio}–{r.oraFine}
              {r.note && <div style={{ fontSize: 12, color: 'var(--nebbia-400)' }}>{r.note}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-secondario" onClick={() => modifica(r)}>Modifica</button>
              <button type="button" className="btn-secondario" onClick={() => elimina(r.id)}>Elimina</button>
            </div>
          </div>
        ))}
      </div>

      <h1 style={{ marginTop: 40 }}>Mezzo non disponibile in date specifiche</h1>
      <p style={{ color: 'var(--nebbia-400)', marginTop: -8, marginBottom: 20 }}>
        Usa questa sezione per un divieto o un fermo puntuale (es. "sabato 18/07 dalle 9:00 alle 22:00").
        Compare nel calendario come un vero e proprio appuntamento in rosso, ben visibile, così sai a
        colpo d'occhio quando il camion non è utilizzabile.
      </p>

      <form onSubmit={salvaIndisponibilita} className="card" style={{ marginBottom: 24 }}>
        <div className="campo">
          <label>Motivo</label>
          <input value={formIndisponibilita.motivo} onChange={(e) => campoIndisponibilita('motivo', e.target.value)} required
            placeholder="Es. Divieto straordinario centro / Manutenzione mezzo" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
          <div className="campo">
            <label>Dal giorno</label>
            <input type="date" value={formIndisponibilita.dataInizio} onChange={(e) => campoIndisponibilita('dataInizio', e.target.value)} required />
          </div>
          <div className="campo">
            <label>Dalle ore</label>
            <input type="time" value={formIndisponibilita.oraInizio} onChange={(e) => campoIndisponibilita('oraInizio', e.target.value)} />
          </div>
          <div className="campo">
            <label>Al giorno</label>
            <input type="date" value={formIndisponibilita.dataFine} onChange={(e) => campoIndisponibilita('dataFine', e.target.value)}
              placeholder={formIndisponibilita.dataInizio} />
          </div>
          <div className="campo">
            <label>Alle ore</label>
            <input type="time" value={formIndisponibilita.oraFine} onChange={(e) => campoIndisponibilita('oraFine', e.target.value)} />
          </div>
        </div>
        <div className="campo">
          <label>Note</label>
          <textarea rows={2} value={formIndisponibilita.note} onChange={(e) => campoIndisponibilita('note', e.target.value)} />
        </div>
        <button type="submit" className="btn-primario" disabled={salvataggioIndisponibilita}>
          {salvataggioIndisponibilita ? 'Salvataggio…' : 'Aggiungi blocco'}
        </button>
      </form>

      <div className="card">
        <h2>Blocchi salvati ({indisponibilita.length})</h2>
        {indisponibilita.length === 0 && <p>Nessun blocco inserito.</p>}
        {indisponibilita.map((i) => (
          <div key={i.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--nebbia-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{i.motivo}</strong> — dal {i.dataInizio} {i.oraInizio} al {i.dataFine} {i.oraFine}
              {i.note && <div style={{ fontSize: 12, color: 'var(--nebbia-400)' }}>{i.note}</div>}
            </div>
            <button type="button" className="btn-secondario" onClick={() => eliminaIndisp(i.id)}>Elimina</button>
          </div>
        ))}
      </div>
    </div>
  )
}
