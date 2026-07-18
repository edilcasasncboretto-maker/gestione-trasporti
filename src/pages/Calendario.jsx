import { useEffect, useMemo, useState } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import startOfWeek from 'date-fns/startOfWeek'
import getDay from 'date-fns/getDay'
import { it } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { ascoltaConsegne } from '../services/firestore'
import { formattaEuro } from '../utils/dateUtils'

const localizer = dateFnsLocalizer({
  format, parse, startOfWeek: () => startOfWeek(new Date(), { locale: it }), getDay,
  locales: { it },
})

export default function Calendario() {
  const [consegne, setConsegne] = useState([])
  const [selezionata, setSelezionata] = useState(null)

  useEffect(() => ascoltaConsegne(setConsegne), [])

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

  return (
    <div>
      <h1>Calendario impegni</h1>
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
          <button className="btn-secondario" onClick={() => setSelezionata(null)}>Chiudi</button>
        </div>
      )}
    </div>
  )
}
