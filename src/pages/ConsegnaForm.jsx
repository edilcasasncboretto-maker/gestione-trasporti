import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MappaConsegna from '../components/MappaConsegna'
import { ascoltaClienti, creaConsegna, aggiornaConsegna, eliminaConsegna, leggiConsegna, leggiMezzo } from '../services/firestore'
import { calcolaPercorsoConTappe, geocodifica } from '../services/routing'
import { calcolaCostoTrasporto } from '../utils/costCalc'

const DEPOSITO_INDIRIZZO = import.meta.env.VITE_INDIRIZZO_DEPOSITO

const vuoto = {
  tipo: 'consegna', cliente: '', indirizzo: '', data: '', oraInizio: '08:00', oraFine: '09:00',
  descrizioneMerce: '', peso_kg: '', volume_m3: '', costoAlKm: '', note: '',
}

export default function ConsegnaForm() {
  const { id } = useParams()
  const modalitaModifica = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState(vuoto)
  const [clienti, setClienti] = useState([])
  const [clienteSelezionato, setClienteSelezionato] = useState('')
  const [destinazioneSelezionata, setDestinazioneSelezionata] = useState('')
  const [mezzo, setMezzo] = useState(null)

  // Punti geocodificati del percorso e tappe intermedie modificabili a mano
  const [deposito, setDeposito] = useState(null)
  const [destinazione, setDestinazione] = useState(null)
  const [coordCache, setCoordCache] = useState(null) // { indirizzo, coord } salvata scegliendo una destinazione da anagrafica
  const [tappe, setTappe] = useState([])
  const [calcolo, setCalcolo] = useState(null)

  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState(null)

  useEffect(() => ascoltaClienti(setClienti), [])
  useEffect(() => { leggiMezzo().then(setMezzo) }, [])

  useEffect(() => {
    if (!modalitaModifica) return
    leggiConsegna(id).then((c) => {
      if (!c) return
      setForm({
        tipo: c.tipo, cliente: c.cliente, indirizzo: c.indirizzo, data: c.data,
        oraInizio: c.oraInizio, oraFine: c.oraFine,
        descrizioneMerce: c.merce?.descrizione || '', peso_kg: c.merce?.peso_kg ?? '',
        volume_m3: c.merce?.volume_m3 ?? '', costoAlKm: c.costoAlKm ?? '', note: c.note || '',
      })
      setDestinazione(c.coord || null)
      setTappe(c.tappe || [])
    })
  }, [id, modalitaModifica])

  const cliente = clienti.find((c) => c.id === clienteSelezionato)
  const destinazioniCliente = cliente?.destinazioni || []

  function campo(chiave, valore) {
    setForm((f) => ({ ...f, [chiave]: valore }))
  }

  function selezionaCliente(idCliente) {
    setClienteSelezionato(idCliente)
    setDestinazioneSelezionata('')
    const c = clienti.find((x) => x.id === idCliente)
    if (c) setForm((f) => ({ ...f, cliente: c.nome }))
  }

  function selezionaDestinazione(idDestinazione) {
    setDestinazioneSelezionata(idDestinazione)
    const dest = destinazioniCliente.find((d) => d.id === idDestinazione)
    if (dest) {
      setForm((f) => ({ ...f, indirizzo: dest.indirizzo }))
      // La destinazione è già geocodificata in anagrafica: evitiamo di richiamare
      // il servizio di geocodifica, la useremo direttamente al momento del calcolo.
      setCoordCache({ indirizzo: dest.indirizzo, coord: dest.coord })
    }
  }

  // Geocodifica deposito e destinazione da zero (indirizzo cambiato o primo calcolo)
  async function calcolaDaZero() {
    setErrore(null)
    setCaricamento(true)
    try {
      const dep = await geocodifica(DEPOSITO_INDIRIZZO)
      const dest = coordCache && coordCache.indirizzo === form.indirizzo
        ? coordCache.coord
        : await geocodifica(form.indirizzo)
      setDeposito(dep)
      setDestinazione(dest)
      await ricalcola(dep, dest, tappe)
    } catch (e) {
      setErrore(e.message)
    } finally {
      setCaricamento(false)
    }
  }

  // Ricalcola solo il percorso (e il costo) usando deposito/destinazione già noti
  // più le tappe intermedie correnti.
  async function ricalcola(depositoAttuale = deposito, destinazioneAttuale = destinazione, tappeAttuali = tappe) {
    if (!depositoAttuale || !destinazioneAttuale) return
    setErrore(null)
    setCaricamento(true)
    try {
      const punti = [depositoAttuale, ...tappeAttuali, destinazioneAttuale]
      const { km, geometria, confiniLeg } = await calcolaPercorsoConTappe(punti, mezzo)
      const costo = calcolaCostoTrasporto(km, parseFloat(form.costoAlKm) || 0)
      setCalcolo({ geometria, confiniLeg, km, ...costo })
    } catch (e) {
      setErrore(e.message)
    } finally {
      setCaricamento(false)
    }
  }

  // Ogni modifica al tracciato (aggiunta/spostamento/rimozione di una tappa,
  // oppure trascinamento diretto della linea) ricalcola km e costo in automatico,
  // come su Google Maps — non serve un pulsante "Ricalcola" separato.
  function aggiornaTappe(nuoveTappe) {
    setTappe(nuoveTappe)
    ricalcola(deposito, destinazione, nuoveTappe)
  }

  async function salva(e) {
    e.preventDefault()
    if (!calcolo || !destinazione) {
      setErrore('Calcola prima il percorso e il costo.')
      return
    }
    const dati = {
      tipo: form.tipo,
      cliente: form.cliente,
      indirizzo: form.indirizzo,
      coord: { lat: destinazione.lat, lng: destinazione.lng },
      tappe,
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
    }
    if (modalitaModifica) await aggiornaConsegna(id, dati)
    else await creaConsegna(dati)
    navigate('/calendario')
  }

  async function elimina() {
    if (confirm('Eliminare definitivamente questo impegno?')) {
      await eliminaConsegna(id)
      navigate('/calendario')
    }
  }

  return (
    <div>
      <h1>{modalitaModifica ? 'Modifica impegno' : 'Nuova consegna / ritiro'}</h1>
      <form onSubmit={salva} className="card" style={{ display: 'grid', gap: 4 }}>
        <div className="campo">
          <label>Tipo</label>
          <select value={form.tipo} onChange={(e) => campo('tipo', e.target.value)}>
            <option value="consegna">Consegna al cliente</option>
            <option value="ritiro">Ritiro per il magazzino</option>
          </select>
        </div>

        {clienti.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: destinazioniCliente.length > 0 ? '1fr 1fr' : '1fr', gap: 16 }}>
            <div className="campo">
              <label>Cliente da anagrafica (opzionale)</label>
              <select value={clienteSelezionato} onChange={(e) => selezionaCliente(e.target.value)}>
                <option value="">— scegli per compilare automaticamente —</option>
                {clienti.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            {destinazioniCliente.length > 0 && (
              <div className="campo">
                <label>Destinazione</label>
                <select value={destinazioneSelezionata} onChange={(e) => selezionaDestinazione(e.target.value)}>
                  <option value="">— scegli indirizzo —</option>
                  {destinazioniCliente.map((d) => <option key={d.id} value={d.id}>{d.etichetta || d.indirizzo}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="campo">
          <label>Cliente</label>
          <input value={form.cliente} onChange={(e) => campo('cliente', e.target.value)} required />
        </div>

        <div className="campo">
          <label>Indirizzo {form.tipo === 'ritiro' ? 'di ritiro' : 'di consegna'}</label>
          <input value={form.indirizzo} onChange={(e) => { campo('indirizzo', e.target.value); setCalcolo(null) }} required
            placeholder="Via, città, provincia" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div className="campo">
            <label>Data</label>
            <input type="date" value={form.data} onChange={(e) => campo('data', e.target.value)} required />
          </div>
          <div className="campo">
            <label>Ora inizio</label>
            <input type="time" value={form.oraInizio} onChange={(e) => campo('oraInizio', e.target.value)} />
          </div>
          <div className="campo">
            <label>Ora fine</label>
            <input type="time" value={form.oraFine} onChange={(e) => campo('oraFine', e.target.value)} />
          </div>
        </div>

        <div className="campo">
          <label>Descrizione merce</label>
          <input value={form.descrizioneMerce} onChange={(e) => campo('descrizioneMerce', e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div className="campo">
            <label>Peso (kg)</label>
            <input type="number" min="0" value={form.peso_kg} onChange={(e) => campo('peso_kg', e.target.value)} />
          </div>
          <div className="campo">
            <label>Volume (m³)</label>
            <input type="number" min="0" step="0.1" value={form.volume_m3} onChange={(e) => campo('volume_m3', e.target.value)} />
          </div>
          <div className="campo">
            <label>Costo al km (€)</label>
            <input type="number" min="0" step="0.01" value={form.costoAlKm} onChange={(e) => { campo('costoAlKm', e.target.value); setCalcolo(null) }} />
          </div>
        </div>

        <div className="campo">
          <label>Note</label>
          <textarea rows={2} value={form.note} onChange={(e) => campo('note', e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button type="button" className="btn-secondario" onClick={calcolaDaZero} disabled={!form.indirizzo || caricamento}>
            {caricamento ? 'Calcolo in corso…' : 'Calcola km e costo'}
          </button>
        </div>

        {errore && <p style={{ color: 'var(--rosso-scadenza)' }}>{errore}</p>}

        {destinazione && (
          <div style={{ marginBottom: 16 }}>
            <MappaConsegna
              partenza={deposito}
              arrivo={destinazione}
              tappe={tappe}
              onTappeChange={aggiornaTappe}
              geometriaRoute={calcolo?.geometria}
              confiniLeg={calcolo?.confiniLeg}
              modificabile
            />
            {caricamento && <p style={{ fontSize: 12, color: 'var(--nebbia-400)' }}>Ricalcolo percorso…</p>}
            {calcolo && (
              <div className="card" style={{ marginTop: 12 }}>
                <p>Andata: <strong className="numero">{Math.round(calcolo.km * 10) / 10} km</strong> — Andata+ritorno: <strong className="numero">{calcolo.kmTotali} km</strong></p>
                <p>Costo grezzo: <span className="numero">{calcolo.costoGrezzo.toFixed(2)} €</span></p>
                <p style={{ fontSize: 18 }}>Da addebitare al cliente (arrotondato): <strong className="numero">{calcolo.costoTrasporto} €</strong></p>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" className="btn-primario">{modalitaModifica ? 'Salva modifiche' : 'Salva impegno'}</button>
          {modalitaModifica && (
            <button type="button" className="btn-secondario" style={{ color: 'var(--rosso-scadenza)' }} onClick={elimina}>
              Elimina impegno
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
