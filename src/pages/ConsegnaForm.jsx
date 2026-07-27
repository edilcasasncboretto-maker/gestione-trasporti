import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MappaConsegna from '../components/MappaConsegna'
import { ascoltaClienti, ascoltaFornitori, creaConsegna, aggiornaConsegna, eliminaConsegna, leggiConsegna, leggiMezzo } from '../services/firestore'
import { calcolaPercorsoConTappe, geocodifica } from '../services/routing'
import { calcolaCostoTrasporto } from '../utils/costCalc'
import { caricaDocumento } from '../services/documenti'

const DEPOSITO_INDIRIZZO = import.meta.env.VITE_INDIRIZZO_DEPOSITO

const vuoto = {
  tipo: 'consegna', cliente: '', telefono: '', indirizzo: '', data: '', oraInizio: '08:00', oraFine: '09:00',
  descrizioneMerce: '', peso_kg: '', volume_m3: '', costoAlKm: '', costoFisso: '', note: '',
}

export default function ConsegnaForm() {
  const { id } = useParams()
  const modalitaModifica = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState(vuoto)
  const [clienti, setClienti] = useState([])
  const [fornitori, setFornitori] = useState([])
  const [anagraficaSelezionata, setAnagraficaSelezionata] = useState('')
  const [destinazioneSelezionata, setDestinazioneSelezionata] = useState('')
  const [mezzo, setMezzo] = useState(null)

  // Punti geocodificati del percorso e tappe intermedie modificabili a mano
  const [deposito, setDeposito] = useState(null)
  const [destinazione, setDestinazione] = useState(null)
  const [coordCache, setCoordCache] = useState(null) // { indirizzo, coord } salvata scegliendo una destinazione da anagrafica
  const [tappe, setTappe] = useState([])
  const [calcolo, setCalcolo] = useState(null)
  const [calcoloDaFonte, setCalcoloDaFonte] = useState(null) // 'salvato' | 'fresco' — solo per mostrare un avviso

  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState(null)

  // Documento PDF/foto relativo alla merce (es. bolla, ordine, packing list)
  const [documento, setDocumento] = useState(null)
  const [fileScelto, setFileScelto] = useState(null)
  const [caricamentoFile, setCaricamentoFile] = useState(false)
  const [erroreFile, setErroreFile] = useState(null)

  useEffect(() => ascoltaClienti(setClienti), [])
  useEffect(() => ascoltaFornitori(setFornitori), [])
  useEffect(() => { leggiMezzo().then(setMezzo) }, [])

  // Il deposito è un punto fisso: lo geocodifichiamo una volta all'apertura della
  // pagina, indipendentemente dal fatto che si stia calcolando un percorso — serve
  // solo a mostrare il marker sulla mappa, non tocca mai il costo salvato.
  useEffect(() => { geocodifica(DEPOSITO_INDIRIZZO).then(setDeposito).catch(() => {}) }, [])

  useEffect(() => {
    if (!modalitaModifica) return
    leggiConsegna(id).then((c) => {
      if (!c) return
      setForm({
        tipo: c.tipo, cliente: c.cliente, telefono: c.telefono || '', indirizzo: c.indirizzo, data: c.data || '',
        oraInizio: c.oraInizio, oraFine: c.oraFine,
        descrizioneMerce: c.merce?.descrizione || '', peso_kg: c.merce?.peso_kg ?? '',
        volume_m3: c.merce?.volume_m3 ?? '', costoAlKm: c.costoAlKm ?? '',
        costoFisso: c.costoForzato ? c.costoTrasporto : '', note: c.note || '',
      })
      setDestinazione(c.coord || null)
      setTappe(c.tappe || [])
      setDocumento(c.documento || null)
      // Usiamo i valori già salvati così com'erano, senza richiamare il servizio di
      // instradamento: aprire una consegna per modificarla (es. solo il telefono)
      // non deve mai forzare un nuovo calcolo del percorso.
      if (c.kmAndata != null) {
        const costoGrezzo = c.costoTrasportoGrezzo || 0
        setCalcolo({
          km: c.kmAndata,
          kmTotali: c.kmTotali,
          costoGrezzo,
          costoTrasporto: c.costoForzato ? Math.ceil(costoGrezzo / 5) * 5 : c.costoTrasporto,
          geometria: null,
          confiniLeg: null,
        })
        setCalcoloDaFonte('salvato')
      }
    })
  }, [id, modalitaModifica])

  const listaAnagrafica = form.tipo === 'ritiro' ? fornitori : clienti
  const etichettaAnagrafica = form.tipo === 'ritiro' ? 'Fornitore' : 'Cliente'
  const anagraficaCorrente = listaAnagrafica.find((c) => c.id === anagraficaSelezionata)
  const destinazioniAnagrafica = anagraficaCorrente?.destinazioni || []

  function campo(chiave, valore) {
    setForm((f) => ({ ...f, [chiave]: valore }))
  }

  function cambiaTipo(nuovoTipo) {
    campo('tipo', nuovoTipo)
    setAnagraficaSelezionata('')
    setDestinazioneSelezionata('')
  }

  function selezionaAnagrafica(idVoce) {
    setAnagraficaSelezionata(idVoce)
    setDestinazioneSelezionata('')
    const voce = listaAnagrafica.find((x) => x.id === idVoce)
    if (voce) setForm((f) => ({ ...f, cliente: voce.nome, telefono: voce.telefono || f.telefono }))
  }

  function selezionaDestinazione(idDestinazione) {
    setDestinazioneSelezionata(idDestinazione)
    const dest = destinazioniAnagrafica.find((d) => d.id === idDestinazione)
    if (dest) {
      setForm((f) => ({ ...f, indirizzo: dest.indirizzo }))
      // La destinazione è già geocodificata in anagrafica: evitiamo di richiamare
      // il servizio di geocodifica, la useremo direttamente al momento del calcolo.
      setCoordCache({ indirizzo: dest.indirizzo, coord: dest.coord })
    }
  }

  // Geocodifica (se serve) e calcola/ricalcola il percorso da zero, incluso il
  // tracciato sulla mappa. Va richiamato esplicitamente, sia per il primo calcolo
  // di un impegno nuovo sia per un ricalcolo volontario di uno già salvato.
  async function calcolaDaZero() {
    setErrore(null)
    setCaricamento(true)
    try {
      const dep = deposito || (await geocodifica(DEPOSITO_INDIRIZZO))
      const dest = coordCache && coordCache.indirizzo === form.indirizzo
        ? coordCache.coord
        : await geocodifica(form.indirizzo)
      setDeposito(dep)
      setDestinazione(dest)
      await ricalcola(dep, dest, tappe)
      setCalcoloDaFonte('fresco')
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
      setCalcoloDaFonte('fresco')
    } catch (e) {
      setErrore(e.message)
    } finally {
      setCaricamento(false)
    }
  }

  // Modificare il tracciato sulla mappa (trascinare la linea, spostare/aggiungere
  // una tappa) è un'azione esplicita dell'utente: in quel caso sì che ha senso
  // ricalcolare km e costo in automatico, a differenza della semplice apertura
  // del form per modificare un altro campo.
  function aggiornaTappe(nuoveTappe) {
    setTappe(nuoveTappe)
    ricalcola(deposito, destinazione, nuoveTappe)
  }

  async function caricaFileMerce(fileDaCaricare) {
    const file = fileDaCaricare || fileScelto
    if (!file) return
    setErroreFile(null)
    setCaricamentoFile(true)
    try {
      const doc = await caricaDocumento(file, 'consegne')
      setDocumento(doc)
      setFileScelto(null)
    } catch (e) {
      setErroreFile(e.message)
    } finally {
      setCaricamentoFile(false)
    }
  }

  async function salva(e) {
    e.preventDefault()
    if (caricamentoFile) {
      setErrore('Attendi che il caricamento del documento sia completato prima di salvare.')
      return
    }
    if (!calcolo || !destinazione) {
      setErrore('Calcola prima il percorso e il costo (pulsante "Calcola km e costo").')
      return
    }
    const costoFissoNumero = form.costoFisso !== '' && !isNaN(parseFloat(form.costoFisso)) ? parseFloat(form.costoFisso) : null
    const dati = {
      tipo: form.tipo,
      cliente: form.cliente,
      telefono: form.telefono,
      indirizzo: form.indirizzo,
      coord: { lat: destinazione.lat, lng: destinazione.lng },
      tappe,
      data: form.data || '',
      oraInizio: form.oraInizio,
      oraFine: form.oraFine,
      merce: {
        descrizione: form.descrizioneMerce,
        peso_kg: parseFloat(form.peso_kg) || 0,
        volume_m3: parseFloat(form.volume_m3) || 0,
      },
      documento,
      costoAlKm: parseFloat(form.costoAlKm) || 0,
      kmAndata: Math.round((calcolo.km || 0) * 10) / 10,
      kmTotali: calcolo.kmTotali,
      costoTrasportoGrezzo: calcolo.costoGrezzo,
      costoForzato: costoFissoNumero != null,
      costoTrasporto: costoFissoNumero != null ? costoFissoNumero : calcolo.costoTrasporto,
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
          <select value={form.tipo} onChange={(e) => cambiaTipo(e.target.value)}>
            <option value="consegna">Consegna al cliente</option>
            <option value="ritiro">Ritiro dal fornitore</option>
          </select>
        </div>

        {listaAnagrafica.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: destinazioniAnagrafica.length > 0 ? '1fr 1fr' : '1fr', gap: 16 }}>
            <div className="campo">
              <label>{etichettaAnagrafica} da anagrafica (opzionale)</label>
              <select value={anagraficaSelezionata} onChange={(e) => selezionaAnagrafica(e.target.value)}>
                <option value="">— scegli per compilare automaticamente —</option>
                {listaAnagrafica.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            </div>
            {destinazioniAnagrafica.length > 0 && (
              <div className="campo">
                <label>Destinazione</label>
                <select value={destinazioneSelezionata} onChange={(e) => selezionaDestinazione(e.target.value)}>
                  <option value="">— scegli indirizzo —</option>
                  {destinazioniAnagrafica.map((d) => <option key={d.id} value={d.id}>{d.etichetta || d.indirizzo}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div className="campo">
            <label>{etichettaAnagrafica}</label>
            <input value={form.cliente} onChange={(e) => campo('cliente', e.target.value)} required />
          </div>
          <div className="campo">
            <label>Telefono <span style={{ fontWeight: 400, textTransform: 'none' }}>(per contatti spot, se non in anagrafica)</span></label>
            <input value={form.telefono} onChange={(e) => campo('telefono', e.target.value)} placeholder="Es. 333 1234567" />
          </div>
        </div>

        <div className="campo">
          <label>Indirizzo {form.tipo === 'ritiro' ? 'di ritiro' : 'di consegna'}</label>
          <input value={form.indirizzo} onChange={(e) => { campo('indirizzo', e.target.value); setCalcolo(null) }} required
            placeholder="Via, città, provincia" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div className="campo">
            <label>Data <span style={{ fontWeight: 400, textTransform: 'none' }}>(opzionale, se non ancora concordata)</span></label>
            <input type="date" value={form.data} onChange={(e) => campo('data', e.target.value)} />
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

        <div className="campo">
          <label>Documento merce (PDF, bolla, ordine...)</label>
          {documento?.url && !caricamentoFile && (
            <p style={{ fontSize: 12, margin: '0 0 6px' }}>
              📎 <a href={documento.url} target="_blank" rel="noreferrer">{documento.nome}</a>
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ flex: 1 }}
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                setFileScelto(file)
                if (file) caricaFileMerce(file)
              }} />
            {caricamentoFile && <span style={{ fontSize: 12, color: 'var(--nebbia-400)' }}>Caricamento in corso…</span>}
          </div>
          {erroreFile && <p style={{ color: 'var(--rosso-scadenza)', fontSize: 12 }}>{erroreFile}</p>}
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
            <input type="number" min="0" step="0.01" value={form.costoAlKm} onChange={(e) => campo('costoAlKm', e.target.value)} />
          </div>
        </div>

        <div className="campo">
          <label>Costo fisso forzato (€) — opzionale</label>
          <input type="number" min="0" step="0.01" value={form.costoFisso} onChange={(e) => campo('costoFisso', e.target.value)}
            placeholder="Lascia vuoto per usare il calcolo automatico" />
          <p style={{ fontSize: 12, color: 'var(--nebbia-400)', marginTop: 4 }}>
            Se compilato, questa cifra sostituisce interamente il calcolo km × costo/km
            (utile per il minimo di spedizione sotto al quale non si scende).
          </p>
        </div>

        <div className="campo">
          <label>Note</label>
          <textarea rows={2} value={form.note} onChange={(e) => campo('note', e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondario" onClick={calcolaDaZero} disabled={!form.indirizzo || caricamento}>
            {caricamento ? 'Calcolo in corso…' : calcolo ? 'Ricalcola percorso e costo' : 'Calcola km e costo'}
          </button>
          {calcoloDaFonte === 'salvato' && (
            <span style={{ fontSize: 12, color: 'var(--nebbia-400)' }}>
              Km e costo mostrati sono quelli già salvati — premi qui solo se vuoi ricalcolarli davvero.
            </span>
          )}
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
            {!calcolo?.geometria && (
              <p style={{ fontSize: 12, color: 'var(--nebbia-400)', marginTop: 6 }}>
                Il tracciato sulla mappa comparirà dopo un ricalcolo — i dati numerici qui sotto restano comunque validi.
              </p>
            )}
            {caricamento && <p style={{ fontSize: 12, color: 'var(--nebbia-400)' }}>Ricalcolo percorso…</p>}
            {calcolo && (
              <div className="card" style={{ marginTop: 12 }}>
                <p>Andata: <strong className="numero">{Math.round(calcolo.km * 10) / 10} km</strong> — Andata+ritorno: <strong className="numero">{calcolo.kmTotali} km</strong></p>
                <p>Costo calcolato (km × costo/km, arrotondato): <span className="numero">{calcolo.costoTrasporto} €</span></p>
                {form.costoFisso !== '' && !isNaN(parseFloat(form.costoFisso)) ? (
                  <p style={{ fontSize: 18 }}>
                    <span className="badge badge-attenzione" style={{ marginRight: 8 }}>Costo forzato</span>
                    Da addebitare al cliente: <strong className="numero">{parseFloat(form.costoFisso).toFixed(2)} €</strong>
                  </p>
                ) : (
                  <p style={{ fontSize: 18 }}>Da addebitare al cliente: <strong className="numero">{calcolo.costoTrasporto} €</strong></p>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" className="btn-primario" disabled={caricamentoFile}>
            {caricamentoFile ? 'Attendi il caricamento…' : modalitaModifica ? 'Salva modifiche' : 'Salva impegno'}
          </button>
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
