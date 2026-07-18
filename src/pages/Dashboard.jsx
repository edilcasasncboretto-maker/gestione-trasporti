import { useEffect, useState } from 'react'
import { ascoltaConsegne, ascoltaMezzo } from '../services/firestore'
import { ETICHETTE_SCADENZE, formattaData, formattaEuro, statoScadenza } from '../utils/dateUtils'

export default function Dashboard() {
  const [consegne, setConsegne] = useState([])
  const [mezzo, setMezzo] = useState(null)

  useEffect(() => {
    const unsub1 = ascoltaConsegne(setConsegne)
    const unsub2 = ascoltaMezzo(setMezzo)
    return () => { unsub1(); unsub2() }
  }, [])

  const oggi = new Date().toISOString().slice(0, 10)
  const prossime = consegne
    .filter((c) => c.stato !== 'annullata' && c.data >= oggi)
    .slice(0, 6)

  const scadenzeUrgenti = mezzo?.scadenze
    ? Object.entries(mezzo.scadenze)
        .map(([chiave, val]) => ({ chiave, ...val, ...statoScadenza(val.data) }))
        .filter((s) => s.stato !== 'ok')
        .sort((a, b) => a.giorniRimanenti - b.giorniRimanenti)
    : []

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

      <div className="card">
        <h2>Prossimi impegni</h2>
        {prossime.length === 0 && <p>Nessuna consegna o ritiro pianificato.</p>}
        {prossime.map((c) => (
          <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--nebbia-200)' }}>
            <strong>{formattaData(c.data)}</strong> — {c.tipo === 'ritiro' ? 'Ritiro da' : 'Consegna a'}{' '}
            {c.cliente} ({c.indirizzo})
            {c.costoTrasporto != null && (
              <span style={{ float: 'right' }} className="numero">{formattaEuro(c.costoTrasporto)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
