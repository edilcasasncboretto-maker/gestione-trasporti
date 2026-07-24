import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ascoltaConsegne, ascoltaMezzo, aggiornaConsegna, eliminaConsegna } from '../services/firestore'
import { ETICHETTE_SCADENZE, formattaData, formattaEuro, statoScadenza } from '../utils/dateUtils'

function ColonnaImpegni({ titolo, colore, elementi, aperto, setAperto, navigate, onEseguita, onElimina }) {
  return (
    <div className="card">
      <h2 style={{ color: colore }}>{titolo} ({elementi.length})</h2>
      {elementi.length === 0 && <p>Nessun impegno.</p>}
      {elementi.map((c) => (
        <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--nebbia-200)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() => setAperto(aperto === c.id ? null : c.id)}>
            <div>
              <strong>{c.data ? formattaData(c.data) : 'Data da definire'}</strong> — {c.cliente}
              {c.costoTrasporto != null && <span className="numero" style={{ marginLeft: 10 }}>{formattaEuro(c.costoTrasporto)}</span>}
            </div>
            <span style={{ color: 'var(--nebbia-400)', fontSize: 12 }}>{aperto === c.id ? '▲ chiudi' : '▼ dettagli'}</span>
          </div>

          {aperto === c.id && (
            <div style={{ marginTop: 10, padding: 12, background: 'var(--nebbia-50)', borderRadius: 6 }}>
              <p style={{ margin: '0 0 6px' }}><strong>Indirizzo:</strong> {c.indirizzo}</p>
              {c.telefono && <p style={{ margin: '0 0 6px' }}><strong>Telefono:</strong> {c.telefono}</p>}
              <p style={{ margin: '0 0 6px' }}><strong>Merce:</strong> {c.merce?.descrizione || '—'} ({c.merce?.peso_kg || 0} kg, {c.merce?.volume_m3 || 0} m³)</p>
              {c.oraInizio && <p style={{ margin: '0 0 6px' }}><strong>Orario:</strong> {c.oraInizio}–{c.oraFine}</p>}
              {c.note && <p style={{ margin: '0 0 6px' }}><strong>Note:</strong> {c.note}</p>}
              {c.documento?.url && (
                <p style={{ margin: '0 0 6px' }}>
                  📎 <a href={c.documento.url} target="_blank" rel="noreferrer">Apri documento allegato</a>
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button type="button" className="btn-primario" onClick={() => navigate(`/modifica-consegna/${c.id}`)}>Modifica</button>
                <button type="button" className="btn-segnale" onClick={() => onEseguita(c.id)}>Segna come eseguita</button>
                <button type="button" className="btn-secondario" style={{ color: 'var(--rosso-scadenza)' }} onClick={() => onElimina(c.id)}>Elimina</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [consegne, setConsegne] = useState([])
  const [mezzo, setMezzo] = useState(null)
  const [aperto, setAperto] = useState(null)

  useEffect(() => {
    const unsub1 = ascoltaConsegne(setConsegne)
    const unsub2 = ascoltaMezzo(setMezzo)
    return () => { unsub1(); unsub2() }
  }, [])

  const attive = useMemo(
    () => consegne
      .filter((c) => c.stato !== 'annullata' && c.stato !== 'completata')
      // le date da definire vanno in fondo, non perse
      .sort((a, b) => (a.data || '9999-99-99').localeCompare(b.data || '9999-99-99')),
    [consegne]
  )

  const consegneAttive = attive.filter((c) => c.tipo === 'consegna')
  const ritiriAttivi = attive.filter((c) => c.tipo === 'ritiro')

  const scadenzeUrgenti = mezzo?.scadenze
    ? Object.entries(mezzo.scadenze)
        .map(([chiave, val]) => ({ chiave, ...val, ...statoScadenza(val.data) }))
        .filter((s) => s.stato !== 'ok')
        .sort((a, b) => a.giorniRimanenti - b.giorniRimanenti)
    : []

  async function segnaEseguita(id) {
    await aggiornaConsegna(id, { stato: 'completata' })
    setAperto(null)
  }

  async function elimina(id) {
    if (confirm('Eliminare definitivamente questo impegno?')) {
      await eliminaConsegna(id)
      setAperto(null)
    }
  }

  return (
    <div>
      <h1>Cruscotto</h1>

      {scadenzeUrgenti.length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderColor: '#f2a900' }}>
          <h2>Scadenze da controllare</h2>
          <div className="griglia-scadenze">
            {scadenzeUrgenti.map((s) => (
              <div key={s.chiave}>
                <span className={`badge ${s.stato === 'scaduto' ? 'badge-scaduto' : 'badge-attenzione'}`}>
                  {s.giorniRimanenti < 0 ? 'Scaduta' : `Tra ${s.giorniRimanenti} giorni`}
                </span>
                <div style={{ marginTop: 6, fontWeight: 600 }}>{ETICHETTE_SCADENZE[s.chiave]}</div>
                <div style={{ color: 'var(--nebbia-400)', fontSize: 12 }}>{formattaData(s.data)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ColonnaImpegni titolo="Consegne da fare" colore="var(--asfalto-950)" elementi={consegneAttive}
          aperto={aperto} setAperto={setAperto} navigate={navigate} onEseguita={segnaEseguita} onElimina={elimina} />
        <ColonnaImpegni titolo="Ritiri da fare" colore="var(--verde-deposito)" elementi={ritiriAttivi}
          aperto={aperto} setAperto={setAperto} navigate={navigate} onEseguita={segnaEseguita} onElimina={elimina} />
      </div>
    </div>
  )
}
