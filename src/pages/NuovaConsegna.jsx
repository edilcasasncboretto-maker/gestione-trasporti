import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MappaConsegna from '../components/MappaConsegna'
import { creaConsegna } from '../services/firestore'
import { distanzaStradaKm, geocodifica } from '../services/routing'
import { calcolaCostoTrasporto } from '../utils/costCalc'

const DEPOSITO_INDIRIZZO = import.meta.env.VITE_INDIRIZZO_DEPOSITO

export default function NuovaConsegna() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    tipo: 'consegna',
    cliente: '',
    indirizzo: '',
    data: '',
    oraInizio: '08:00',
    oraFine: '09:00',
    descrizioneMerce: '',
    peso_kg: '',
    volume_m3: '',
    costoAlKm: '',
    note: '',
  })
  const [calcolo, setCalcolo] = useState(null)
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState(null)

  function aggiorna(campo, valore) {
    setForm((f) => ({ ...f, [campo]: valore }))
    setCalcolo(null)
  }

  async function calcolaPercorso() {
    setErrore(null)
    setCaricamento(true)
    try {
      const deposito = await geocodifica(DEPOSITO_INDIRIZZO)
      const destinazione = await geocodifica(form.indirizzo)
      const { km, geometria } = await distanzaStradaKm(deposito, destinazione)
      const costo = calcolaCostoTrasporto(km, parseFloat(form.costoAlKm) || 0)
      setCalcolo({ deposito, destinazione, km, geometria, ...costo })
    } catch (e) {
      setErrore(e.message)
    } finally {
      setCaricamento(false)
    }
  }

  async function salva(e) {
    e.preventDefault()
    if (!calcolo) {
      setErrore('Calcola prima il percorso e il costo.')
      return
    }
    await creaConsegna({
      tipo: form.tipo,
      cliente: form.cliente,
      indirizzo: form.indirizzo,
      coord: { lat: calcolo.destinazione.lat, lng: calcolo.destinazione.lng },
      data: form.data,
      oraInizio: form.oraInizio,
      oraFine: form.oraFine,
      merce: {
        descrizione: form.descrizioneMerce,
        peso_kg: parseFloat(form.peso_kg) || 0,
        volume_m3: parseFloat(form.volume_m3) || 0,
      },
      costoAlKm: parseFloat(form.costoAlKm) || 0,
      kmAndata: Math.round((calcolo.km || 0) * 10) / 10,
      kmTotali: calcolo.kmTotali,
      costoTrasportoGrezzo: calcolo.costoGrezzo,
      costoTrasporto: calcolo.costoTrasporto,
      stato: 'pianificata',
      note: form.note,
    })
    navigate('/calendario')
  }

  return (
    <div>
      <h1>Nuova consegna / ritiro</h1>
      <form onSubmit={salva} className="card" style={{ display: 'grid', gap: 4 }}>
        <div className="campo">
          <label>Tipo</label>
          <select value={form.tipo} onChange={(e) => aggiorna('tipo', e.target.value)}>
            <option value="consegna">Consegna al cliente</option>
            <option value="ritiro">Ritiro per il magazzino</option>
          </select>
        </div>

        <div className="campo">
          <label>Cliente</label>
          <input value={form.cliente} onChange={(e) => aggiorna('cliente', e.target.value)} required />
        </div>

        <div className="campo">
          <label>Indirizzo {form.tipo === 'ritiro' ? 'di ritiro' : 'di consegna'}</label>
          <input value={form.indirizzo} onChange={(e) => aggiorna('indirizzo', e.target.value)} required
            placeholder="Via, città, provincia" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div className="campo">
            <label>Data</label>
            <input type="date" value={form.data} onChange={(e) => aggiorna('data', e.target.value)} required />
          </div>
          <div className="campo">
            <label>Ora inizio</label>
            <input type="time" value={form.oraInizio} onChange={(e) => aggiorna('oraInizio', e.target.value)} />
          </div>
          <div className="campo">
            <label>Ora fine</label>
            <input type="time" value={form.oraFine} onChange={(e) => aggiorna('oraFine', e.target.value)} />
          </div>
        </div>

        <div className="campo">
          <label>Descrizione merce</label>
          <input value={form.descrizioneMerce} onChange={(e) => aggiorna('descrizioneMerce', e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div className="campo">
            <label>Peso (kg)</label>
            <input type="number" min="0" value={form.peso_kg} onChange={(e) => aggiorna('peso_kg', e.target.value)} />
          </div>
          <div className="campo">
            <label>Volume (m³)</label>
            <input type="number" min="0" step="0.1" value={form.volume_m3} onChange={(e) => aggiorna('volume_m3', e.target.value)} />
          </div>
          <div className="campo">
            <label>Costo al km (€)</label>
            <input type="number" min="0" step="0.01" value={form.costoAlKm} onChange={(e) => aggiorna('costoAlKm', e.target.value)} />
          </div>
        </div>

        <div className="campo">
          <label>Note</label>
          <textarea rows={2} value={form.note} onChange={(e) => aggiorna('note', e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button type="button" className="btn-secondario" onClick={calcolaPercorso} disabled={!form.indirizzo || caricamento}>
            {caricamento ? 'Calcolo in corso…' : 'Calcola km e costo'}
          </button>
        </div>

        {errore && <p style={{ color: 'var(--rosso-scadenza)' }}>{errore}</p>}

        {calcolo && (
          <div style={{ marginBottom: 16 }}>
            <MappaConsegna partenza={calcolo.deposito} arrivo={calcolo.destinazione} geometriaRoute={calcolo.geometria} />
            <div className="card" style={{ marginTop: 12 }}>
              <p>Andata: <strong className="numero">{Math.round(calcolo.km * 10) / 10} km</strong> — Andata+ritorno: <strong className="numero">{calcolo.kmTotali} km</strong></p>
              <p>Costo grezzo: <span className="numero">{calcolo.costoGrezzo.toFixed(2)} €</span></p>
              <p style={{ fontSize: 18 }}>Da addebitare al cliente (arrotondato): <strong className="numero">{calcolo.costoTrasporto} €</strong></p>
            </div>
          </div>
        )}

        <button type="submit" className="btn-primario">Salva impegno</button>
      </form>
    </div>
  )
}
