import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ascoltaConsegne, aggiornaConsegna } from '../services/firestore'
import { formattaData, formattaEuro } from '../utils/dateUtils'

export default function Archivio() {
  const navigate = useNavigate()
  const [consegne, setConsegne] = useState([])
  const [testoRicerca, setTestoRicerca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStato, setFiltroStato] = useState('')
  const [dataDa, setDataDa] = useState('')
  const [dataA, setDataA] = useState('')

  useEffect(() => ascoltaConsegne(setConsegne), [])

  const archiviate = useMemo(() => {
    return consegne
      .filter((c) => c.stato === 'completata' || c.stato === 'annullata')
      .filter((c) => !testoRicerca || c.cliente?.toLowerCase().includes(testoRicerca.toLowerCase()) || c.indirizzo?.toLowerCase().includes(testoRicerca.toLowerCase()))
      .filter((c) => !filtroTipo || c.tipo === filtroTipo)
      .filter((c) => !filtroStato || c.stato === filtroStato)
      .filter((c) => !dataDa || (c.data && c.data >= dataDa))
      .filter((c) => !dataA || (c.data && c.data <= dataA))
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
  }, [consegne, testoRicerca, filtroTipo, filtroStato, dataDa, dataA])

  async function riportaAPianificata(id) {
    await aggiornaConsegna(id, { stato: 'pianificata' })
  }

  return (
    <div>
      <h1>Archivio</h1>
      <p style={{ color: 'var(--nebbia-400)', marginTop: -8, marginBottom: 20 }}>
        Storico di consegne e ritiri già eseguiti o annullati. Quelli ancora da fare restano nel
        Cruscotto e nel Calendario.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 16 }}>
          <div className="campo">
            <label>Cerca (cliente/fornitore o indirizzo)</label>
            <input value={testoRicerca} onChange={(e) => setTestoRicerca(e.target.value)} placeholder="Nome o indirizzo..." />
          </div>
          <div className="campo">
            <label>Tipo</label>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Tutti</option>
              <option value="consegna">Consegne</option>
              <option value="ritiro">Ritiri</option>
            </select>
          </div>
          <div className="campo">
            <label>Stato</label>
            <select value={filtroStato} onChange={(e) => setFiltroStato(e.target.value)}>
              <option value="">Tutti</option>
              <option value="completata">Eseguite</option>
              <option value="annullata">Annullate</option>
            </select>
          </div>
          <div className="campo">
            <label>Dal</label>
            <input type="date" value={dataDa} onChange={(e) => setDataDa(e.target.value)} />
          </div>
          <div className="campo">
            <label>Al</label>
            <input type="date" value={dataA} onChange={(e) => setDataA(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>{archiviate.length} risultati</h2>
        {archiviate.length === 0 && <p>Nessun impegno archiviato con questi filtri.</p>}
        {archiviate.map((c) => (
          <div key={c.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--nebbia-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <span className={`badge ${c.stato === 'completata' ? 'badge-ok' : 'badge-scaduto'}`} style={{ marginRight: 8 }}>
                {c.stato === 'completata' ? 'Eseguita' : 'Annullata'}
              </span>
              <strong>{c.data ? formattaData(c.data) : 'Senza data'}</strong> — {c.tipo === 'ritiro' ? 'Ritiro da' : 'Consegna a'} {c.cliente} ({c.indirizzo})
              {c.costoTrasporto != null && <span className="numero" style={{ marginLeft: 10 }}>{formattaEuro(c.costoTrasporto)}</span>}
              {c.documento?.url && (
                <span style={{ marginLeft: 10 }}>
                  <a href={c.documento.url} target="_blank" rel="noreferrer">📎 documento</a>
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button type="button" className="btn-secondario" onClick={() => navigate(`/modifica-consegna/${c.id}`)}>Apri</button>
              <button type="button" className="btn-secondario" onClick={() => riportaAPianificata(c.id)}>Riporta attiva</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
