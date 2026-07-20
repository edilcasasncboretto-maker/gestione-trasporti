import { useEffect, useState } from 'react'
import { ascoltaClienti, aggiornaCliente, creaCliente, eliminaCliente } from '../services/firestore'
import { geocodifica } from '../services/routing'

const vuoto = { nome: '', indirizzo: '', referente: '', telefono: '', note: '' }

export default function Clienti() {
  const [clienti, setClienti] = useState([])
  const [form, setForm] = useState(vuoto)
  const [idInModifica, setIdInModifica] = useState(null)
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState(null)

  useEffect(() => ascoltaClienti(setClienti), [])

  function campo(chiave, valore) {
    setForm((f) => ({ ...f, [chiave]: valore }))
  }

  function modificaCliente(c) {
    setIdInModifica(c.id)
    setForm({ nome: c.nome, indirizzo: c.indirizzo, referente: c.referente || '', telefono: c.telefono || '', note: c.note || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function annullaModifica() {
    setIdInModifica(null)
    setForm(vuoto)
  }

  async function salva(e) {
    e.preventDefault()
    setErrore(null)
    setSalvataggio(true)
    try {
      // Geocodifica e salva le coordinate una sola volta, così in "Nuova consegna"
      // selezionare un cliente non richiede una nuova chiamata di geocodifica.
      const coord = await geocodifica(form.indirizzo)
      const dati = { ...form, coord: { lat: coord.lat, lng: coord.lng } }
      if (idInModifica) {
        await aggiornaCliente(idInModifica, dati)
      } else {
        await creaCliente(dati)
      }
      annullaModifica()
    } catch (e2) {
      setErrore(e2.message)
    } finally {
      setSalvataggio(false)
    }
  }

  async function elimina(id) {
    if (confirm('Eliminare definitivamente questo cliente dall\'anagrafica?')) {
      await eliminaCliente(id)
    }
  }

  return (
    <div>
      <h1>Anagrafica clienti</h1>

      <form onSubmit={salva} className="card" style={{ marginBottom: 24 }}>
        <h2>{idInModifica ? 'Modifica cliente' : 'Nuovo cliente'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="campo">
            <label>Nome / ragione sociale</label>
            <input value={form.nome} onChange={(e) => campo('nome', e.target.value)} required />
          </div>
          <div className="campo">
            <label>Indirizzo</label>
            <input value={form.indirizzo} onChange={(e) => campo('indirizzo', e.target.value)} required
              placeholder="Via, città, provincia" />
          </div>
          <div className="campo">
            <label>Referente</label>
            <input value={form.referente} onChange={(e) => campo('referente', e.target.value)} />
          </div>
          <div className="campo">
            <label>Telefono</label>
            <input value={form.telefono} onChange={(e) => campo('telefono', e.target.value)} />
          </div>
        </div>
        <div className="campo">
          <label>Note</label>
          <textarea rows={2} value={form.note} onChange={(e) => campo('note', e.target.value)} />
        </div>
        {errore && <p style={{ color: 'var(--rosso-scadenza)' }}>{errore}</p>}
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" className="btn-primario" disabled={salvataggio}>
            {salvataggio ? 'Salvataggio…' : idInModifica ? 'Salva modifiche' : 'Aggiungi cliente'}
          </button>
          {idInModifica && (
            <button type="button" className="btn-secondario" onClick={annullaModifica}>Annulla</button>
          )}
        </div>
      </form>

      <div className="card">
        <h2>Elenco clienti ({clienti.length})</h2>
        {clienti.length === 0 && <p>Nessun cliente in anagrafica.</p>}
        {clienti.map((c) => (
          <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--nebbia-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{c.nome}</strong> — {c.indirizzo}
              {c.referente && <div style={{ fontSize: 12, color: 'var(--nebbia-400)' }}>{c.referente} {c.telefono && `· ${c.telefono}`}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-secondario" onClick={() => modificaCliente(c)}>Modifica</button>
              <button type="button" className="btn-secondario" onClick={() => elimina(c.id)}>Elimina</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
