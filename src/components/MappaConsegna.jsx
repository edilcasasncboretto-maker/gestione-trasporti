import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet'
import { useEffect, useRef } from 'react'
import L from 'leaflet'

const iconaEstremo = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

const iconaTappa = new L.DivIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#f2a900;border:2px solid #14181d;box-shadow:0 0 0 2px #fff;"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function AdattaVista({ partenza, arrivo }) {
  const map = useMap()
  useEffect(() => {
    if (partenza && arrivo) {
      map.fitBounds([
        [partenza.lat, partenza.lng],
        [arrivo.lat, arrivo.lng],
      ], { padding: [40, 40] })
    } else if (partenza) {
      map.setView([partenza.lat, partenza.lng], 12)
    }
  }, [partenza, arrivo, map])
  return null
}

function GestoreClick({ attivo, onClick }) {
  useMapEvents({
    click(e) {
      if (attivo) onClick(e.latlng)
    },
  })
  return null
}

// Trova, tra i punti della geometria del percorso, l'indice più vicino a una posizione data.
function indiceGeometriaPiuVicino(geometria, latlng) {
  let migliorIndice = 0
  let migliorDistanza = Infinity
  geometria.coordinates.forEach(([lng, lat], i) => {
    const d = L.latLng(lat, lng).distanceTo(latlng)
    if (d < migliorDistanza) {
      migliorDistanza = d
      migliorIndice = i
    }
  })
  return migliorIndice
}

// Dato l'indice nella geometria complessiva, capisce a quale tratta (tra due punti
// consecutivi del percorso) appartiene, usando i confini calcolati da routing.js.
// Ritorna la posizione in cui inserire la nuova tappa nell'array `tappe`.
function posizioneInserimento(indiceGeometria, confiniLeg) {
  if (!confiniLeg || confiniLeg.length === 0) return 0
  for (let i = 0; i < confiniLeg.length; i++) {
    if (confiniLeg[i] == null || indiceGeometria <= confiniLeg[i]) return i
  }
  return confiniLeg.length - 1
}

// Abilita il trascinamento diretto della linea del percorso (come su Google Maps):
// tenendo premuto sul tracciato e trascinando, si crea una nuova tappa nel punto
// in cui si rilascia il tasto, inserita automaticamente nella posizione corretta.
function LineaTrascinabile({ polylineRef, attivo, geometria, confiniLeg, onNuovaTappa }) {
  const map = useMap()
  const trascinamento = useRef(null)

  useEffect(() => {
    const layer = polylineRef.current
    if (!layer || !attivo || !geometria) return

    function alMouseDown(e) {
      L.DomEvent.stop(e)
      map.dragging.disable()
      trascinamento.current = true
      map.on('mousemove', alMuoviMouse)
      map.on('mouseup', alRilascioMouse)
      map.getContainer().style.cursor = 'grabbing'
    }

    function alMuoviMouse() {
      // Il tracciato provvisorio si aggiorna visivamente solo al rilascio,
      // per non moltiplicare le chiamate al servizio di instradamento.
    }

    function alRilascioMouse(e) {
      map.off('mousemove', alMuoviMouse)
      map.off('mouseup', alRilascioMouse)
      map.dragging.enable()
      map.getContainer().style.cursor = ''
      trascinamento.current = false
      const indiceGeometria = indiceGeometriaPiuVicino(geometria, e.latlng)
      const posizione = posizioneInserimento(indiceGeometria, confiniLeg)
      onNuovaTappa(posizione, { lat: e.latlng.lat, lng: e.latlng.lng })
    }

    layer.on('mousedown', alMouseDown)
    return () => {
      layer.off('mousedown', alMouseDown)
      map.off('mousemove', alMuoviMouse)
      map.off('mouseup', alRilascioMouse)
    }
  }, [polylineRef.current, attivo, geometria, confiniLeg])

  return null
}

/*
Props:
- partenza, arrivo: { lat, lng } — estremi fissi del percorso
- tappe: [{ lat, lng }] — punti intermedi, modificabili
- onTappeChange(nuoveTappe): richiamata quando l'utente aggiunge, sposta o rimuove una tappa
- geometriaRoute: GeoJSON LineString del percorso calcolato (opzionale)
- confiniLeg: indici di confine tra le tratte nella geometria (restituiti da calcolaPercorsoConTappe)
- modificabile: se true, si può trascinare la linea per aggiungere una tappa nel punto esatto,
  trascinare una tappa esistente per spostarla, click destro per eliminarla
*/
export default function MappaConsegna({ partenza, arrivo, tappe = [], onTappeChange, geometriaRoute, confiniLeg, modificabile = false }) {
  const centro = partenza || { lat: 42.5, lng: 12.5 }
  const polylineRef = useRef(null)

  const puntiPolilinea = geometriaRoute
    ? geometriaRoute.coordinates.map(([lng, lat]) => [lat, lng])
    : null

  function aggiungiTappa(latlng) {
    if (geometriaRoute) {
      const indiceGeometria = indiceGeometriaPiuVicino(geometriaRoute, latlng)
      const posizione = posizioneInserimento(indiceGeometria, confiniLeg)
      inserisciTappa(posizione, { lat: latlng.lat, lng: latlng.lng })
    } else {
      onTappeChange?.([...tappe, { lat: latlng.lat, lng: latlng.lng }])
    }
  }

  function inserisciTappa(posizione, punto) {
    const nuove = tappe.slice()
    nuove.splice(posizione, 0, punto)
    onTappeChange?.(nuove)
  }

  function spostaTappa(indice, latlng) {
    const nuove = tappe.slice()
    nuove[indice] = { lat: latlng.lat, lng: latlng.lng }
    onTappeChange?.(nuove)
  }

  function rimuoviTappa(indice) {
    onTappeChange?.(tappe.filter((_, i) => i !== indice))
  }

  return (
    <div>
      <MapContainer center={[centro.lat, centro.lng]} zoom={6} style={{ height: 360, borderRadius: 6 }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {partenza && <Marker position={[partenza.lat, partenza.lng]} icon={iconaEstremo} />}
        {arrivo && <Marker position={[arrivo.lat, arrivo.lng]} icon={iconaEstremo} />}
        {tappe.map((t, i) => (
          <Marker
            key={i}
            position={[t.lat, t.lng]}
            icon={iconaTappa}
            draggable={modificabile}
            eventHandlers={{
              dragend: (e) => spostaTappa(i, e.target.getLatLng()),
              contextmenu: () => modificabile && rimuoviTappa(i),
            }}
          />
        ))}
        {puntiPolilinea && (
          <Polyline
            ref={polylineRef}
            positions={puntiPolilinea}
            color="#f2a900"
            weight={6}
            eventHandlers={modificabile ? { mouseover: (e) => (e.target._map.getContainer().style.cursor = 'grab') } : {}}
          />
        )}
        <GestoreClick attivo={modificabile} onClick={aggiungiTappa} />
        <LineaTrascinabile
          polylineRef={polylineRef}
          attivo={modificabile}
          geometria={geometriaRoute}
          confiniLeg={confiniLeg}
          onNuovaTappa={inserisciTappa}
        />
        <AdattaVista partenza={partenza} arrivo={arrivo} />
      </MapContainer>
      {modificabile && (
        <p style={{ fontSize: 12, color: 'var(--nebbia-400)', marginTop: 6 }}>
          Trascina il tracciato arancione per correggere il percorso (si aggiorna in automatico
          appena rilasci). Le tappe già aggiunte si trascinano per spostarle o si eliminano con
          click destro. Puoi anche cliccare su un punto vuoto della mappa per aggiungere una tappa.
        </p>
      )}
    </div>
  )
}
