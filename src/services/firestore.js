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

export async function leggiConsegna(id) {
  const snap = await getDoc(doc(db, 'consegne', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// ---- Clienti (anagrafica) ------------------------------------------------
const clientiRef = collection(db, 'clienti')

export function ascoltaClienti(callback) {
  const q = query(clientiRef, orderBy('nome', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export function creaCliente(dati) {
  return addDoc(clientiRef, { ...dati, createdAt: new Date().toISOString() })
}

export function aggiornaCliente(id, dati) {
  return updateDoc(doc(db, 'clienti', id), dati)
}

export function eliminaCliente(id) {
  return deleteDoc(doc(db, 'clienti', id))
}

/*
Struttura documento clienti/{id}:
{
  nome: 'string',
  referente: 'string',
  telefono: 'string',
  note: 'string',
  destinazioni: [
    { id: 'string', etichetta: 'string', indirizzo: 'string', coord: { lat, lng } }
  ]
}
*/

// ---- Restrizioni di transito mezzi pesanti (inserite manualmente) -------
const restrizioniRef = collection(db, 'restrizioni')

export function ascoltaRestrizioni(callback) {
  return onSnapshot(restrizioniRef, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export function creaRestrizione(dati) {
  return addDoc(restrizioniRef, { ...dati, createdAt: new Date().toISOString() })
}

export function aggiornaRestrizione(id, dati) {
  return updateDoc(doc(db, 'restrizioni', id), dati)
}

export function eliminaRestrizione(id) {
  return deleteDoc(doc(db, 'restrizioni', id))
}

/*
Struttura documento restrizioni/{id}:
{
  zona: 'string',              // es. "Centro storico Bergamo"
  giorni: ['lun','mar','mer','gio','ven'],  // giorni della settimana in cui vale il divieto
  oraInizio: 'HH:mm',
  oraFine: 'HH:mm',
  sogliaQuintali: 75,           // sopra questo peso il divieto si applica (informativo)
  note: 'string'
}
*/

// ---- Indisponibilità del mezzo in date specifiche (es. fermo per manutenzione,
//      divieto straordinario un certo giorno) — compaiono come appuntamento nel calendario
const indisponibilitaRef = collection(db, 'indisponibilita')

export function ascoltaIndisponibilita(callback) {
  return onSnapshot(indisponibilitaRef, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export function creaIndisponibilita(dati) {
  return addDoc(indisponibilitaRef, { ...dati, createdAt: new Date().toISOString() })
}

export function eliminaIndisponibilita(id) {
  return deleteDoc(doc(db, 'indisponibilita', id))
}

/*
Struttura documento indisponibilita/{id}:
{
  motivo: 'string',        // es. "Divieto straordinario centro" o "Manutenzione mezzo"
  dataInizio: 'YYYY-MM-DD',
  oraInizio: 'HH:mm',
  dataFine: 'YYYY-MM-DD',
  oraFine: 'HH:mm',
  note: 'string'
}
*/

// ---- Impostazioni notifiche email scadenze -------------------------------
const notificheDocRef = doc(db, 'impostazioni', 'notifiche')

export function ascoltaImpostazioniNotifiche(callback) {
  return onSnapshot(notificheDocRef, (snap) => {
    callback(snap.exists() ? snap.data() : null)
  })
}

export function salvaImpostazioniNotifiche(dati) {
  return setDoc(notificheDocRef, dati, { merge: true })
}

/*
Struttura documento impostazioni/notifiche:
{
  email: 'ufficio@azienda.it',
  soglieGiorni: [30, 14, 7, 3, 1, 0],  // quanti giorni prima della scadenza ricevere un avviso
  attivo: true
}
La funzione automatica che invia le email (api/controlla-scadenze.js) gira una
volta al giorno tramite Vercel Cron e legge questi valori.
*/

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
  libretto: { url: 'https://...', nome: 'libretto.pdf', caricatoIl: '2026-07-22T10:00:00.000Z' },
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
