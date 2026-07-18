import {
  addDoc, collection, deleteDoc, doc, onSnapshot,
  orderBy, query, setDoc, updateDoc, getDoc,
} from 'firebase/firestore'
import { db } from '../firebase'

// ---- Consegne / ritiri --------------------------------------------------
const consegneRef = collection(db, 'consegne')

export function ascoltaConsegne(callback) {
  const q = query(consegneRef, orderBy('data', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export function creaConsegna(dati) {
  return addDoc(consegneRef, { ...dati, createdAt: new Date().toISOString() })
}

export function aggiornaConsegna(id, dati) {
  return updateDoc(doc(db, 'consegne', id), dati)
}

export function eliminaConsegna(id) {
  return deleteDoc(doc(db, 'consegne', id))
}

// ---- Mezzo (dati unici del camion) --------------------------------------
const mezzoDocRef = doc(db, 'mezzo', 'principale')

export async function leggiMezzo() {
  const snap = await getDoc(mezzoDocRef)
  return snap.exists() ? snap.data() : null
}

export function ascoltaMezzo(callback) {
  return onSnapshot(mezzoDocRef, (snap) => {
    callback(snap.exists() ? snap.data() : null)
  })
}

export function salvaMezzo(dati) {
  return setDoc(mezzoDocRef, dati, { merge: true })
}

/*
Struttura documento mezzo/principale:
{
  targa: 'AB123CD',
  modello: 'Iveco Eurocargo',
  portata_kg: 7500,
  cassone_lunghezza_m: 6.2,
  cassone_larghezza_m: 2.4,
  cassone_altezza_m: 2.3,
  km_attuali: 84500,
  scadenze: {
    assicurazione:   { data: '2026-11-10', costo: 1450 },
    bollo:           { data: '2026-09-01', costo: 890 },
    revisione_mezzo: { data: '2027-02-15', costo: 120 },
    revisione_gru:   { data: '2026-08-20', costo: 210 },
  }
}
*/

/*
Struttura documento consegne/{id}:
{
  tipo: 'consegna' | 'ritiro',
  cliente: 'string',
  indirizzo: 'string',
  coord: { lat, lng },
  data: 'YYYY-MM-DD',
  oraInizio: 'HH:mm',
  oraFine: 'HH:mm',
  merce: { descrizione: 'string', peso_kg: number, volume_m3: number },
  costoAlKm: number,
  kmAndata: number,
  kmTotali: number,           // andata + ritorno
  costoTrasportoGrezzo: number,
  costoTrasporto: number,      // arrotondato per eccesso a multipli di 5
  stato: 'pianificata' | 'completata' | 'annullata',
  note: 'string'
}
*/
