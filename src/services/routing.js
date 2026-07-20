// Wrapper per le API gratuite di OpenRouteService (https://openrouteservice.org)
// Serve una API key gratuita: https://openrouteservice.org/dev/#/signup
// Profilo "driving-hgv" = calcolato per mezzi pesanti (tiene conto di limiti
// di peso/altezza sulle strade quando vengono passati i parametri del veicolo).

const ORS_BASE = 'https://api.openrouteservice.org'
const ORS_KEY = import.meta.env.VITE_ORS_API_KEY

function headers() {
  return {
    Authorization: ORS_KEY,
    'Content-Type': 'application/json',
  }
}

// Trasforma un indirizzo testuale in coordinate { lat, lng }
export async function geocodifica(indirizzo) {
  const url = `${ORS_BASE}/geocode/search?api_key=${ORS_KEY}&text=${encodeURIComponent(
    indirizzo
  )}&boundary.country=ITA&size=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Geocodifica fallita: ' + res.status)
  const data = await res.json()
  const feature = data.features?.[0]
  if (!feature) throw new Error('Indirizzo non trovato: ' + indirizzo)
  const [lng, lat] = feature.geometry.coordinates
  return { lat, lng, etichetta: feature.properties.label }
}

// Calcola la distanza stradale (andata) in km tra due punti, profilo mezzo pesante.
// mezzo opzionale: { portata_kg, cassone_altezza_m } per rispettare i limiti stradali.
export async function distanzaStradaKm(partenza, arrivo, mezzo) {
  const { km, durataMin, geometria } = await calcolaPercorsoConTappe([partenza, arrivo], mezzo)
  return { km, durataMin, geometria }
}

// Come sopra, ma accetta un percorso con tappe intermedie (waypoint) inserite
// manualmente dall'utente trascinandole sulla mappa, per correggere un percorso
// che il calcolo automatico non stima bene per un mezzo pesante.
// punti: [partenza, ...tappeIntermedie, arrivo], ognuno { lat, lng }
export async function calcolaPercorsoConTappe(punti, mezzo) {
  if (!punti || punti.length < 2) throw new Error('Servono almeno due punti per calcolare un percorso')
  const url = `${ORS_BASE}/v2/directions/driving-hgv/geojson`
  const body = {
    coordinates: punti.map((p) => [p.lng, p.lat]),
  }
  if (mezzo) {
    body.options = {
      vehicle_type: 'hgv',
      profile_params: {
        restrictions: {
          weight: mezzo.portata_kg ? mezzo.portata_kg / 1000 : undefined, // tonnellate
          height: mezzo.cassone_altezza_m || undefined,
        },
      },
    }
  }
  const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
  if (!res.ok) throw new Error('Calcolo percorso fallito: ' + res.status)
  const data = await res.json()
  const metri = data.features[0].properties.summary.distance
  const durataMin = data.features[0].properties.summary.duration / 60
  const geometria = data.features[0].geometry // GeoJSON LineString, utile per disegnare la rotta su mappa
  return { km: metri / 1000, durataMin, geometria }
}

/*
Ottimizzazione multi-tappa (motore VROOM integrato in ORS).
Prende in ingresso il deposito, la lista di fermate del giorno (consegne/ritiri)
e la capacità del mezzo, e restituisce l'ordine ottimale delle tappe.

fermate: [{ id, coord: {lat,lng}, peso_kg, volume_m3, tipo: 'consegna'|'ritiro' }]
mezzo:   { portata_kg, cassone_lunghezza_m, cassone_larghezza_m, cassone_altezza_m }

Nota sulla capacità: VROOM lavora con interi su più dimensioni. Usiamo:
  dimensione 0 = peso in kg
  dimensione 1 = volume in litri (m3 * 1000)
Le 'delivery' sono merce caricata in deposito e scaricata dal cliente (consegne).
Le 'pickup' sono merce caricata dal cliente e portata in deposito (ritiri).
*/
export async function ottimizzaPercorso({ deposito, fermate, mezzo }) {
  const capacitaVolumeLitri = Math.round(
    (mezzo.cassone_lunghezza_m || 0) * (mezzo.cassone_larghezza_m || 0) * (mezzo.cassone_altezza_m || 0) * 1000
  )

  const vehicles = [
    {
      id: 1,
      profile: 'driving-hgv',
      start: [deposito.lng, deposito.lat],
      end: [deposito.lng, deposito.lat],
      capacity: [mezzo.portata_kg || 0, capacitaVolumeLitri || 0],
    },
  ]

  const jobs = fermate.map((f, i) => {
    const quantita = [Math.round(f.peso_kg || 0), Math.round((f.volume_m3 || 0) * 1000)]
    const job = {
      id: i + 1,
      location: [f.coord.lng, f.coord.lat],
    }
    if (f.tipo === 'ritiro') job.pickup = quantita
    else job.delivery = quantita
    return job
  })

  const res = await fetch(`${ORS_BASE}/optimization`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ jobs, vehicles }),
  })
  if (!res.ok) throw new Error('Ottimizzazione fallita: ' + res.status)
  const data = await res.json()
  const route = data.routes?.[0]
  if (!route) throw new Error('Nessun percorso trovato: verifica che il mezzo abbia capacità sufficiente')

  // Riordina le fermate originali secondo l'ordine restituito da VROOM
  const ordineTappe = route.steps
    .filter((s) => s.type === 'job')
    .map((s) => fermate[s.id - 1])

  return {
    ordineTappe,
    kmTotali: route.distance / 1000,
    durataTotaleMin: route.duration / 60,
  }
}
