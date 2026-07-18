// Calcola il costo del trasporto: km andata+ritorno * costo al km,
// arrotondato per eccesso al multiplo di 5 € superiore.
// Esempio: 42.30 € -> 45 €.  40.00 € -> 40 € (già multiplo, non si arrotonda oltre).
export function calcolaCostoTrasporto(kmAndata, costoAlKm) {
  const kmTotali = kmAndata * 2
  const costoGrezzo = kmTotali * costoAlKm
  const costoTrasporto = Math.ceil(costoGrezzo / 5) * 5
  return {
    kmTotali: Math.round(kmTotali * 10) / 10,
    costoGrezzo: Math.round(costoGrezzo * 100) / 100,
    costoTrasporto,
  }
}
