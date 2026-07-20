import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet'
import { useEffect } from 'react'
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

/*
Props:
- partenza, arrivo: { lat, lng } — estremi fissi del percorso
- tappe: [{ lat, lng }] — punti intermedi che l'utente può aggiungere/trascinare per correggere il percorso
- onTappeChange(nuoveTappe): richiamata quando l'utente aggiunge, sposta o rimuove una tappa
- geometriaRoute: GeoJSON LineString del percorso calcolato (opzionale)
- modificabile: se true, un click sulla mappa aggiunge una tappa; le tappe si trascinano
  e si eliminano con click destro
*/
export default function MappaConsegna({ partenza, arrivo, tappe = [], onTappeChange, geometriaRoute, modificabile = false }) {
  const centro = partenza || { lat: 42.5, lng: 12.5 }

  const puntiPolilinea = geometriaRoute
    ? geometriaRoute.coordinates.map(([lng, lat]) => [lat, lng])
    : null

  function aggiungiTappa(latlng) {
    onTappeChange?.([...tappe, { lat: latlng.lat, lng: latlng.lng }])
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
      <MapContainer center={[centro.lat, centro.lng]} zoom={6} style={{ height: 360, borderRadius: 6, cursor: modificabile ? 'copy' : '' }}>
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
        {puntiPolilinea && <Polyline positions={puntiPolilinea} color="#f2a900" weight={4} />}
        <GestoreClick attivo={modificabile} onClick={aggiungiTappa} />
        <AdattaVista partenza={partenza} arrivo={arrivo} />
      </MapContainer>
      {modificabile && (
        <p style={{ fontSize: 12, color: 'var(--nebbia-400)', marginTop: 6 }}>
          Clicca sulla mappa per aggiungere un punto di passaggio, trascinalo per spostarlo,
          click destro per rimuoverlo. Poi premi "Ricalcola" per aggiornare km e costo.
        </p>
      )}
    </div>
  )
}
