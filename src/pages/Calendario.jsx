import { useEffect, useMemo, useState } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import startOfWeek from 'date-fns/startOfWeek'
import getDay from 'date-fns/getDay'
import { it } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useNavigate } from 'react-router-dom'
import { ascoltaConsegne, ascoltaRestrizioni, eliminaConsegna } from '../services/firestore'
import { formattaEuro } from '../utils/dateUtils'

const localizer = dateFnsLocalizer({
  format, parse, startOfWeek: () => startOfWeek(new Date(), { locale: it }), getDay,
  locales: { it },
})

const GIORNI_SETTIMANA = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']

export default function Calendario() {
  const navigate = useNavigate()
  const [consegne, setConsegne] = useState([])
  const [restrizioni, setRestrizioni] = useState([])
  const [selezionata, setSelezionata] = useState(null)

  useEffect(() => {
    const u1 = ascoltaConsegne(setConsegne)
    const u2 = ascoltaRestrizioni(setRestrizioni)
    return () => { u1(); u2() }
  }, [])

  const eventi = useMemo(
    () =>
      consegne.map((c) => {
        const inizio = new Date(`${c.data}T${c.oraInizio || '08:00'}`)
        const fine = new Date(`${c.data}T${c.oraFine || '09:00'}`)
        return {
          id: c.id,
          title: `${c.tipo === 'ritiro' ? 'Ritiro' : 'Consegna'} — ${c.cliente}`,
          start: inizio,
          end: fine,
          risorsa: c,
        }
      }),
    [consegne]
  )

  function restrizioniAttiveNelGiorno(dataISO) {
    if (!dataISO) return []
    const giorno = GIORNI_SETTIMANA[new Date(dataISO).getDay()]
    return restrizioni.filter((r) => (r.giorni || []).includes(giorno))
  }

  const restrizioniSelezionata = selezionata ? restrizioniAttiveNelGiorno(selezionata.data) : []

  async function elimina(idConsegna) {
    if (confirm('Eliminare definitivamente questo impegno?')) {
      await eliminaConsegna(idConsegna)
      setSelezionata(null)
    }
  }

  return (
    <div>
      <h1>Calendario impegni</h1>

      {restrizioni.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>Divieti di transito attivi da tenere presente</h2>
          <div className="griglia-scadenze">
            {restrizioni.map((r) => (
              <div key={r.id}>
                <span className="badge badge-attenzione">oltre {r.sogliaQuintali} q.li</span>
                <div style={{ marginTop: 6, fontWeight: 600 }}>{r.zona}</div>
                <div style={{ fontSize: 12, color: 'var(--nebbia-400)' }}>
                  {(r.giorni || []).join(', ')} · {r.oraInizio}–{r.oraFine}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ height: 640 }}>
        <Calendar
          localizer={localizer}
          events={eventi}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          culture="it"
          messages={{
            next: 'Avanti', previous: 'Indietro', today: 'Oggi',
            month: 'Mese', week: 'Settimana', day: 'Giorno', agenda: 'Agenda',
          }}
          eventPropGetter={(evento) => ({
            style: {
              backgroundColor: evento.risorsa.tipo === 'ritiro' ? '#2f8f5b' : '#14181d',
              borderRadius: 3,
            },
          })}
          onSelectEvent={(evento) => setSelezionata(evento.risorsa)}
        />
      </div>

      {selezionata && (
        <div className="card" style={{ marginTop: 20 }}>
          <h2>{selezionata.tipo === 'ritiro' ? 'Ritiro' : 'Consegna'} — {selezionata.cliente}</h2>
          <p><strong>Indirizzo:</strong> {selezionata.indirizzo}</p>
          <p><strong>Merce:</strong> {selezionata.merce?.descrizione} ({selezionata.merce?.peso_kg} kg, {selezionata.merce?.volume_m3} m³)</p>
          <p><strong>Km andata/ritorno:</strong> {selezionata.kmTotali} km</p>
          <p><strong>Costo trasporto:</strong> {formattaEuro(selezionata.costoTrasporto)}</p>
          {selezionata.note && <p><strong>Note:</strong> {selezionata.note}</p>}

          {restrizioniSelezionata.length > 0 && (
            <div style={{ background: '#fdf1dc', border: '1px solid var(--ambra-500)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
              <strong>Attenzione — divieti quel giorno:</strong>
              <ul style={{ margin: '6px 0 0 18px' }}>
                {restrizioniSelezionata.map((r) => (
                  <li key={r.id}>{r.zona}: vietato oltre {r.sogliaQuintali} q.li dalle {r.oraInizio} alle {r.oraFine}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primario" onClick={() => navigate(`/modifica-consegna/${selezionata.id}`)}>Modifica</button>
            <button className="btn-secondario" style={{ color: 'var(--rosso-scadenza)' }} onClick={() => elimina(selezionata.id)}>Elimina</button>
            <button className="btn-secondario" onClick={() => setSelezionata(null)}>Chiudi</button>
          </div>
        </div>
      )}
    </div>
  )
}
