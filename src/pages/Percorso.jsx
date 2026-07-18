import { useEffect, useState } from 'react'
import { ascoltaConsegne, ascoltaMezzo } from '../services/firestore'
import { geocodifica, ottimizzaPercorso } from '../services/routing'

const DEPOSITO_INDIRIZZO = import.meta.env.VITE_INDIRIZZO_DEPOSITO

export default function Percorso() {
  const [consegne, setConsegne] = useState([])
  const [mezzo, setMezzo] = useState(null)
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [risultato, setRisultato] = useState(null)
  const [errore, setErrore] = useState(null)
  const [caricamento, setCaricamento] = useState(false)

  useEffect(() => {
    const u1 = ascoltaConsegne(setConsegne)
    const u2 = ascoltaMezzo(setMezzo)
    return () => { u1(); u2() }
  }, [])

  const fermateDelGiorno = consegne.filter((c) => c.data === data && c.stato !== 'annullata')

  const pesoTotale = fermateDelGiorno.reduce((s, c) => s + (c.merce?.peso_kg || 0), 0)
  const volumeTotale = fermateDelGiorno.reduce((s, c) => s + (c.merce?.volume_m3 || 0), 0)
  const superaPortata = mezzo && pesoTotale > (mezzo.portata_kg || 0)

  async function calcola() {
    setErrore(null)
    setRisultato(null)
    if (fermateDelGiorno.length === 0) { setErrore('Nessuna consegna/ritiro pianificato per questa data.'); return }
    if (!mezzo) { setErrore('Inserisci prima i dati del mezzo nella pagina Scadenze.'); return }
    setCaricamento(true)
    try {
      const deposito = await geocodifica(DEPOSITO_INDIRIZZO)
      const fermate = fermateDelGiorno.map((c) => ({
        id: c.id,
        coord: c.coord,
        peso_kg: c.merce?.peso_kg || 0,
        volume_m3: c.merce?.volume_m3 || 0,
        tipo: c.tipo,
        cliente: c.cliente,
        indirizzo: c.indirizzo,
      }))
      const esito = await ottimizzaPercorso({ deposito, fermate, mezzo })
      setRisultato(esito)
    } catch (e) {
      setErrore(e.message)
    } finally {
      setCaricamento(false)
    }
  }

  return (
    <div>
      <h1>Ottimizza percorso giornaliero</h1>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="campo" style={{ maxWidth: 240 }}>
          <label>Data</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>

        <p>{fermateDelGiorno.length} tappe pianificate — carico totale: <strong className="numero">{pesoTotale} kg</strong>, <strong className="numero">{volumeTotale} m³</strong></p>
        {mezzo && <p>Portata mezzo: <strong className="numero">{mezzo.portata_kg} kg</strong></p>}
        {superaPortata && (
          <p style={{ color: 'var(--rosso-scadenza)' }}>
            Attenzione: il carico totale supera la portata del mezzo. Valuta di spostare una tappa a un altro giorno.
          </p>
        )}

        <button className="btn-primario" onClick={calcola} disabled={caricamento}>
          {caricamento ? 'Calcolo in corso…' : 'Calcola percorso ottimale'}
        </button>
        {errore && <p style={{ color: 'var(--rosso-scadenza)', marginTop: 12 }}>{errore}</p>}
      </div>

      {risultato && (
        <div className="card">
          <h2>Ordine di tappe consigliato</h2>
          <ol>
            {risultato.ordineTappe.map((t, i) => (
              <li key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--nebbia-200)' }}>
                <strong>{t.tipo === 'ritiro' ? 'Ritiro' : 'Consegna'}</strong> — {t.cliente} ({t.indirizzo})
                <span style={{ float: 'right', color: 'var(--nebbia-400)' }}>{t.peso_kg} kg · {t.volume_m3} m³</span>
              </li>
            ))}
          </ol>
          <p style={{ marginTop: 16 }}>
            Percorso totale (deposito → tappe → deposito): <strong className="numero">{Math.round(risultato.kmTotali * 10) / 10} km</strong>
            {' '}— tempo di guida stimato: <strong className="numero">{Math.round(risultato.durataTotaleMin)} min</strong>
          </p>
        </div>
      )}
    </div>
  )
}
