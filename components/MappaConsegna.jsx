import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'

// Le icone di default di Leaflet non si caricano bene col bundler: le ridefiniamo via CDN.
const iconaPartenza = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
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

// geometriaRoute: GeoJSON LineString restituito da OpenRouteService (opzionale)
export default function MappaConsegna({ partenza, arrivo, geometriaRoute }) {
  const centro = partenza || { lat: 42.5, lng: 12.5 } // centro Italia di default

  const puntiPolilinea = geometriaRoute
    ? geometriaRoute.coordinates.map(([lng, lat]) => [lat, lng])
    : null

  return (
    <MapContainer center={[centro.lat, centro.lng]} zoom={6} style={{ height: 360, borderRadius: 6 }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {partenza && <Marker position={[partenza.lat, partenza.lng]} icon={iconaPartenza} />}
      {arrivo && <Marker position={[arrivo.lat, arrivo.lng]} icon={iconaPartenza} />}
      {puntiPolilinea && <Polyline positions={puntiPolilinea} color="#f2a900" weight={4} />}
      <AdattaVista partenza={partenza} arrivo={arrivo} />
    </MapContainer>
  )
}
