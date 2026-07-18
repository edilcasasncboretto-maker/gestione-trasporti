import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

export const SOGLIA_ATTENZIONE_GIORNI = 30
export const SOGLIA_URGENTE_GIORNI = 7

export const ETICHETTE_SCADENZE = {
  assicurazione: 'Assicurazione',
  bollo: 'Bollo',
  revisione_mezzo: 'Revisione mezzo',
  revisione_gru: 'Revisione gru',
}

// Ritorna { stato: 'ok'|'attenzione'|'scaduto', giorniRimanenti }
export function statoScadenza(dataISO) {
  if (!dataISO) return { stato: 'ok', giorniRimanenti: null }
  const giorniRimanenti = differenceInCalendarDays(parseISO(dataISO), new Date())
  if (giorniRimanenti < 0) return { stato: 'scaduto', giorniRimanenti }
  if (giorniRimanenti <= SOGLIA_URGENTE_GIORNI) return { stato: 'scaduto', giorniRimanenti }
  if (giorniRimanenti <= SOGLIA_ATTENZIONE_GIORNI) return { stato: 'attenzione', giorniRimanenti }
  return { stato: 'ok', giorniRimanenti }
}

export function formattaData(dataISO) {
  if (!dataISO) return '—'
  return format(parseISO(dataISO), 'd MMMM yyyy', { locale: it })
}

export function formattaEuro(valore) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(valore || 0)
}
