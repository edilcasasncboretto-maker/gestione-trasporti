import { useEffect, useState } from 'react'
import { ascoltaFornitori, aggiornaFornitore, creaFornitore, eliminaFornitore } from '../services/firestore'
import { geocodifica } from '../services/routing'

function nuovaDestinazioneVuota() {
  return { id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, etichetta: '', indirizzo: '' }
}

const vuoto = { nome: '', referente: '', telefono: '', note: '', destinazioni: [nuovaDestinazioneVuota()] }

export default function Fornitori() {
  const [fornitori, setFornitori] = useState([])
  const [form, setForm] = useState(vuoto)
  const [idInModifica, setIdInModifica] = useState(null)
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState(null)

  useEffect(() => ascoltaFornitori(setFornitori), [])

  function campo(chiave, valore) {
    setForm((f) => ({ ...f, [chiave]: valore }))
  }

  function campoDestinazione(indice, chiave, valore) {
    setForm((f) => {
      const destinazioni = f.destinazioni.slice()
      destinazioni[indice] = { ...destinazioni[indice], [chiave]: valore }
      return { ...f, destinazioni }
    })
  }

  function aggiungiDestinazione() {
    setForm((f) => ({ ...f, destinazioni: [...f.destinazioni, nuovaDestinazioneVuota()] }))
  }

  function rimuoviDestinazione(indice) {
    setForm((f) => ({ ...f, destinazioni: f.destinazioni.filter((_, i) => i !== indice) }))
  }

  function modificaFornitore(f0) {
    setIdInModifica(f0.id)
    setForm({
      nome: f0.nome,
      referente: f0.referente || '',
      telefono: f0.telefono || '',
      note: f0.note || '',
      destinazioni: f0.destinazioni?.length ? f0.destinazioni : [nuovaDestinazioneVuota()],
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function annullaModifica() {
    setIdInModifica(null)
    setForm(vuoto)
  }

  async function salva(e) {
    e.preventDefault()
    setErrore(null)
    const destinazioniValide = form.destinazioni.filter((d) => d.indirizzo.trim())
    if (destinazioniValide.length === 0) {
      setErrore('Inserisci almeno una destinazione con indirizzo.')
      return
    }
    setSalvataggio(true)
    try {
      const destinazioni = []
      for (const d of destinazioniValide) {
        const coord = await geocodifica(d.indirizzo)
        destinazioni.push({ id: d.id, etichetta: d.etichetta || 'Sede', indirizzo: d.indirizzo, coord: { lat: coord.lat, lng: coord.lng } })
      }
      const dati = { nome: form.nome, referente: form.referente, telefono: form.telefono, note: form.note, destinazioni }
      if (idInModifica) await aggiornaFornitore(idInModifica, dati)
      else await creaFornitore(dati)
      annullaModifica()
    } catch (e2) {
      setErrore(e2.message)
    } finally {
      setSalvataggio(false)
    }
  }

  async function elimina(id) {
    if (confirm('Eliminare definitivamente questo fornitore dall\'anagrafica?')) {
      await eliminaFornitore(id)
    }
  }

  return (
    <div>
      <h1>Anagrafica fornitori</h1>
      <p style={{ color: 'var(--nebbia-400)', marginTop: -8, marginBottom: 20 }}>
        Usati per i ritiri (carichi da portare al magazzino). Nel form "Nuova consegna/ritiro",
        selezionando "Ritiro" comparirà questa anagrafica invece di quella clienti.
      </p>

      <form onSubmit={salva} className="card" style={{ marginBottom: 24 }}>
        <h2>{idInModifica ? 'Modifica fornitore' : 'Nuovo fornitore'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="campo">
            <label>Nome / ragione sociale</label>
            <input value={form.nome} onChange={(e) => campo('nome', e.target.value)} required />
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

        <label style={{ marginTop: 8 }}>Destinazioni (sedi, magazzini, cantieri...)</label>
        {form.destinazioni.map((d, i) => (
          <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 10, marginBottom: 8, alignItems: 'end' }}>
            <div>
              <label style={{ marginBottom: 2 }}>Etichetta</label>
              <input value={d.etichetta} onChange={(e) => campoDestinazione(i, 'etichetta', e.target.value)}
                placeholder="Es. Sede, Magazzino Sud" />
            </div>
            <div>
              <label style={{ marginBottom: 2 }}>Indirizzo</label>
              <input value={d.indirizzo} onChange={(e) => campoDestinazione(i, 'indirizzo', e.target.value)}
                placeholder="Via, città, provincia" />
            </div>
            <button type="button" className="btn-secondario" onClick={() => rimuoviDestinazione(i)}
              disabled={form.destinazioni.length === 1} style={{ height: 36 }}>
              Rimuovi
            </button>
          </div>
        ))}
        <button type="button" className="btn-secondario" onClick={aggiungiDestinazione} style={{ marginBottom: 16, width: 'fit-content' }}>
          + Aggiungi destinazione
        </button>

        <div className="campo">
          <label>Note</label>
          <textarea rows={2} value={form.note} onChange={(e) => campo('note', e.target.value)} />
        </div>
        {errore && <p style={{ color: 'var(--rosso-scadenza)' }}>{errore}</p>}
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" className="btn-primario" disabled={salvataggio}>
            {salvataggio ? 'Salvataggio…' : idInModifica ? 'Salva modifiche' : 'Aggiungi fornitore'}
          </button>
          {idInModifica && (
            <button type="button" className="btn-secondario" onClick={annullaModifica}>Annulla</button>
          )}
        </div>
      </form>

      <div className="card">
        <h2>Elenco fornitori ({fornitori.length})</h2>
        {fornitori.length === 0 && <p>Nessun fornitore in anagrafica.</p>}
        {fornitori.map((f) => (
          <div key={f.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--nebbia-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <strong>{f.nome}</strong>
              {f.referente && <div style={{ fontSize: 12, color: 'var(--nebbia-400)' }}>{f.referente} {f.telefono && `· ${f.telefono}`}</div>}
              <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                {(f.destinazioni || []).map((d) => (
                  <li key={d.id} style={{ fontSize: 13 }}>{d.etichetta}: {d.indirizzo}</li>
                ))}
              </ul>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-secondario" onClick={() => modificaFornitore(f)}>Modifica</button>
              <button type="button" className="btn-secondario" onClick={() => elimina(f.id)}>Elimina</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
