import { useEffect, useState } from 'react'
import { ascoltaMezzo, salvaMezzo } from '../services/firestore'
import { ETICHETTE_SCADENZE, formattaData, statoScadenza } from '../utils/dateUtils'

const CHIAVI_SCADENZE = ['assicurazione', 'bollo', 'revisione_mezzo', 'revisione_gru']

const vuoto = {
  targa: '', modello: '', portata_kg: '', cassone_lunghezza_m: '', cassone_larghezza_m: '',
  cassone_altezza_m: '', km_attuali: '',
  scadenze: Object.fromEntries(CHIAVI_SCADENZE.map((k) => [k, { data: '', costo: '' }])),
}

export default function Scadenze() {
  const [dati, setDati] = useState(vuoto)
  const [salvataggio, setSalvataggio] = useState(false)

  useEffect(() => ascoltaMezzo((m) => { if (m) setDati({ ...vuoto, ...m, scadenze: { ...vuoto.scadenze, ...m.scadenze } }) }), [])

  function campo(chiave, valore) {
    setDati((d) => ({ ...d, [chiave]: valore }))
  }

  function campoScadenza(tipo, sottochiave, valore) {
    setDati((d) => ({
      ...d,
      scadenze: { ...d.scadenze, [tipo]: { ...d.scadenze[tipo], [sottochiave]: valore } },
    }))
  }

  async function salva(e) {
    e.preventDefault()
    setSalvataggio(true)
    await salvaMezzo({
      ...dati,
      portata_kg: parseFloat(dati.portata_kg) || 0,
      cassone_lunghezza_m: parseFloat(dati.cassone_lunghezza_m) || 0,
      cassone_larghezza_m: parseFloat(dati.cassone_larghezza_m) || 0,
      cassone_altezza_m: parseFloat(dati.cassone_altezza_m) || 0,
      km_attuali: parseFloat(dati.km_attuali) || 0,
    })
    setSalvataggio(false)
  }

  return (
    <div>
      <h1>Mezzo e scadenze</h1>
      <form onSubmit={salva} className="card" style={{ marginBottom: 24 }}>
        <h2>Dati mezzo</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div className="campo"><label>Targa</label><input value={dati.targa} onChange={(e) => campo('targa', e.target.value)} /></div>
          <div className="campo"><label>Modello</label><input value={dati.modello} onChange={(e) => campo('modello', e.target.value)} /></div>
          <div className="campo"><label>Km attuali</label><input type="number" value={dati.km_attuali} onChange={(e) => campo('km_attuali', e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
          <div className="campo"><label>Portata (kg)</label><input type="number" value={dati.portata_kg} onChange={(e) => campo('portata_kg', e.target.value)} /></div>
          <div className="campo"><label>Cassone lunghezza (m)</label><input type="number" step="0.1" value={dati.cassone_lunghezza_m} onChange={(e) => campo('cassone_lunghezza_m', e.target.value)} /></div>
          <div className="campo"><label>Cassone larghezza (m)</label><input type="number" step="0.1" value={dati.cassone_larghezza_m} onChange={(e) => campo('cassone_larghezza_m', e.target.value)} /></div>
          <div className="campo"><label>Cassone altezza (m)</label><input type="number" step="0.1" value={dati.cassone_altezza_m} onChange={(e) => campo('cassone_altezza_m', e.target.value)} /></div>
        </div>

        <h2 style={{ marginTop: 20 }}>Scadenze</h2>
        <div className="griglia-scadenze" style={{ marginBottom: 16 }}>
          {CHIAVI_SCADENZE.map((chiave) => (
            <div key={chiave} className="card">
              <label>{ETICHETTE_SCADENZE[chiave]}</label>
              <div className="campo">
                <input type="date" value={dati.scadenze[chiave]?.data || ''}
                  onChange={(e) => campoScadenza(chiave, 'data', e.target.value)} />
              </div>
              <div className="campo">
                <input type="number" step="0.01" placeholder="Costo €"
                  value={dati.scadenze[chiave]?.costo || ''}
                  onChange={(e) => campoScadenza(chiave, 'costo', e.target.value)} />
              </div>
            </div>
          ))}
        </div>

        <button type="submit" className="btn-primario" disabled={salvataggio}>
          {salvataggio ? 'Salvataggio…' : 'Salva'}
        </button>
      </form>

      <div className="card">
        <h2>Stato scadenze</h2>
        <div className="griglia-scadenze">
          {CHIAVI_SCADENZE.map((chiave) => {
            const s = statoScadenza(dati.scadenze[chiave]?.data)
            return (
              <div key={chiave}>
                <span className={`badge ${s.stato === 'ok' ? 'badge-ok' : s.stato === 'attenzione' ? 'badge-attenzione' : 'badge-scaduto'}`}>
                  {s.giorniRimanenti == null ? 'Non impostata' : s.giorniRimanenti < 0 ? 'Scaduta' : `${s.giorniRimanenti} giorni`}
                </span>
                <div style={{ marginTop: 6, fontWeight: 600 }}>{ETICHETTE_SCADENZE[chiave]}</div>
                <div style={{ fontSize: 12, color: 'var(--nebbia-400)' }}>{formattaData(dati.scadenze[chiave]?.data)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
