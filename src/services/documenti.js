// Caricamento file (libretto, bollo, assicurazione...) su Cloudinary.
// Serve un account gratuito: https://cloudinary.com/users/register/free
// Non richiede carta di credito. Il caricamento avviene direttamente dal
// browser tramite un "upload preset" non firmato (nessun server necessario,
// nessuna chiave segreta esposta nel codice).

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

// cartella: sotto-cartella logica su Cloudinary, utile per tenere ordinati i documenti
// (es. "mezzo/assicurazione"). Ritorna { url, nome, caricatoIl } da salvare su Firestore.
export async function caricaDocumento(file, cartella = 'documenti') {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary non configurato: mancano VITE_CLOUDINARY_CLOUD_NAME o VITE_CLOUDINARY_UPLOAD_PRESET')
  }
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', cartella)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const dettaglio = await res.json().catch(() => null)
    throw new Error('Caricamento documento fallito: ' + (dettaglio?.error?.message || res.status))
  }
  const data = await res.json()
  return { url: data.secure_url, nome: file.name, caricatoIl: new Date().toISOString() }
}
