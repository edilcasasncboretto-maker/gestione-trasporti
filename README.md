# Gestione Trasporti — scaffold v1

App interna per la gestione del camion aziendale: calendario impegni, calcolo
del costo di trasporto da addebitare al cliente, scadenze del mezzo (assicurazione,
bollo, revisione, revisione gru) con alert, e ottimizzazione del percorso
giornaliero su più consegne/ritiri in base a peso e volume della merce.

## Stack

- **React + Vite** — frontend
- **Firebase Firestore** — database (consegne/ritiri, dati del mezzo)
- **OpenRouteService (ORS)** — geocodifica indirizzi, calcolo km su strada
  (profilo mezzi pesanti), ottimizzazione multi-tappa con vincoli di
  peso/volume. Gratuito, richiede solo la registrazione.
- **Leaflet** — visualizzazione mappa (tile OpenStreetMap, gratuiti)
- **GitHub + Vercel** — versionamento e hosting/deploy automatico

## 1. Crea il progetto Firebase

1. Vai su https://console.firebase.google.com → **Aggiungi progetto**.
2. Una volta creato, entra in **Impostazioni progetto → Le tue app → Aggiungi app → Web**.
3. Copia i valori di configurazione (apiKey, authDomain, ecc.) — ti serviranno nel passo 4.
4. Nel menu laterale vai su **Build → Firestore Database → Crea database** (modalità produzione, region europea es. `eur3`).
5. In **Regole**, incolla il contenuto del file `firestore.rules` di questo progetto (accesso libero iniziale, pensato per uso interno d'ufficio — puoi aggiungere l'autenticazione in un secondo momento).

## 2. Crea l'account gratuito Cloudinary (per caricare libretto, bollo, assicurazione)

Cloudinary è un servizio di archiviazione file con un piano gratuito ampio
(25 crediti/mese, più che sufficiente per pochi documenti) e **non richiede
carta di credito**.

1. Registrati su https://cloudinary.com/users/register/free
2. Una volta dentro, nella Dashboard trovi in alto il tuo **Cloud name** — copialo, ti serve nel passo 4.
3. Vai su **Settings** (icona ingranaggio) → scheda **Upload** → sezione "Upload presets" → **Add upload preset**.
   - Imposta **Signing Mode** su **Unsigned** (fondamentale: permette il caricamento diretto dal browser senza bisogno di un server).
   - Puoi lasciare tutto il resto di default, oppure impostare una cartella base tipo `gestione-trasporti`.
   - Salva e copia il **nome del preset** che ti viene assegnato (o quello che hai scelto tu) — ti serve nel passo 4.

## 3. Configura l'invio email delle notifiche (Resend + Firebase)

Le notifiche funzionano tramite un piccolo controllo automatico che gira una
volta al giorno (gratis, vedi sezione "Come funziona" più sotto). Servono due cose:

**a) Account gratuito Resend (invio email)**

1. Registrati su https://resend.com con l'indirizzo email a cui vuoi ricevere gli
   avvisi (es. l'email dell'ufficio) — **è importante registrarti proprio con
   quell'indirizzo**: senza un dominio personalizzato verificato (passaggio
   avanzato, non necessario qui), Resend permette di inviare gratuitamente solo
   verso l'indirizzo con cui ti sei registrato, il che per un singolo ufficio va
   benissimo così com'è.
2. Vai su **API Keys** → **Create API Key**, lascia i permessi di default, copia
   la chiave (inizia con `re_...`) — ti serve nel passo successivo.

**b) Chiave di servizio Firebase (permette alla funzione automatica di leggere Firestore)**

1. Nella Console Firebase del tuo progetto, vai su **Impostazioni progetto**
   (icona ingranaggio) → scheda **Account di servizio**.
2. Clicca **Genera nuova chiave privata** → conferma. Si scarica un file `.json`.
3. Apri quel file con un editor di testo (anche il Blocco note/TextEdit va bene),
   seleziona tutto il contenuto e copialo: ti serve tra un attimo, per intero,
   incollato come UNICA variabile d'ambiente su Vercel.

## 4. Ottieni la API key gratuita di OpenRouteService

1. Registrati su https://openrouteservice.org/dev/#/signup
2. Crea una API key gratuita (piano "free", limiti ampi per uso da ufficio singolo).

## 5. Configura le variabili d'ambiente

Copia `.env.example` in `.env` e compila tutti i valori (config Firebase, API
key ORS, indirizzo del tuo deposito/magazzino — è il punto di partenza/arrivo
usato per i calcoli di andata/ritorno).

```
cp .env.example .env
```

## 6. Avvio in locale

```
npm install
npm run dev
```

## 7. Carica su GitHub

```
git init
git add .
git commit -m "Primo scaffold gestione trasporti"
gh repo create gestione-trasporti --private --source=. --push
```

(oppure crea il repo dall'interfaccia GitHub e collega il remote con `git remote add origin ...`)

## 8. Deploy su Vercel

1. Vai su https://vercel.com → **Add New → Project** → importa il repo GitHub appena creato.
2. Framework rilevato automaticamente: **Vite**.
3. In **Environment Variables**, incolla tutte le chiavi presenti nel tuo `.env` (Vercel non legge il file `.env`, vanno inserite manualmente nel pannello).
4. Aggiungi **anche** queste tre variabili, che servono solo alla funzione automatica delle notifiche e non vanno mai messe nel file `.env` del sito (sono segrete, lato server):
   - `RESEND_API_KEY` → la chiave copiata al passo 3a
   - `FIREBASE_SERVICE_ACCOUNT_KEY` → l'intero contenuto del file `.json` scaricato al passo 3b, incollato così com'è (Vercel gestisce bene anche testo su più righe)
   - `CRON_SECRET` → una stringa a caso, lunga, inventata da te (es. generata su https://www.uuidgenerator.net) — serve solo a impedire che altri possano invocare la funzione di invio email dall'esterno
5. Deploy. Ad ogni push su GitHub, Vercel aggiorna automaticamente l'app.

### Come funziona il controllo automatico

Vercel esegue la funzione `api/controlla-scadenze.js` una volta al giorno da
solo (è configurato in `vercel.json`, orario indicativo verso le 7-8 del
mattino — sul piano gratuito Vercel garantisce l'esecuzione entro l'ora
indicata, non al minuto esatto). Non devi fare nulla: una volta impostate le
variabili d'ambiente sopra e configurata l'email nella pagina "Notifiche"
dell'app, parte da sola. Puoi verificare che tutto funzioni con il pulsante
"Invia email di prova" nella stessa pagina.

## Struttura dati Firestore

- `mezzo/principale` — un unico documento con targa, portata, misure cassone,
  km attuali e scadenze (assicurazione, bollo, revisione mezzo, revisione gru,
  ciascuna con data e costo).
- `consegne/{id}` — una consegna o ritiro: cliente, indirizzo, coordinate,
  data/ora, merce (peso/volume), costo al km, km andata/ritorno, costo di
  trasporto calcolato (arrotondato per eccesso a multipli di 5 €).

Dettagli campo per campo nei commenti di `src/services/firestore.js`.

## Cosa fa già questa v1

- **Calendario** (`/calendario`): vista mensile/settimanale degli impegni del camion.
  Aprendo un impegno puoi **modificarlo** o **eliminarlo**. In cima alla pagina e
  nel dettaglio di ogni impegno vedi anche eventuali **divieti di transito** attivi
  quel giorno. I blocchi di indisponibilità in date specifiche (vedi sotto) compaiono
  come appuntamenti in rosso, ben visibili.
- **Nuova consegna/ritiro** (`/nuova-consegna`, e `/modifica-consegna/:id` per
  modificare un impegno esistente): form che geocodifica l'indirizzo, calcola i
  km stradali di andata dal deposito (profilo mezzo pesante), mostra la mappa
  col tracciato e calcola il costo da addebitare (km andata+ritorno × costo/km,
  arrotondato per eccesso a multipli di 5 €). Puoi selezionare un cliente già
  salvato in anagrafica e, se ne ha più di una, scegliere tra le sue destinazioni
  per compilare automaticamente l'indirizzo. Puoi allegare un **documento PDF o
  foto relativo alla merce** (bolla, ordine, packing list...) e, se serve un
  **costo fisso minimo di spedizione**, compilare il campo "Costo fisso forzato":
  se impostato, sostituisce completamente il calcolo automatico km × costo/km.
  **Il percorso sulla mappa si corregge trascinando la linea, come su Google Maps**:
  tieni premuto sul tracciato arancione e trascinalo nel punto giusto — km e costo
  si aggiornano da soli al rilascio. Le tappe aggiunte si possono anche spostare
  trascinandole singolarmente o eliminare con click destro.
- **Clienti** (`/clienti`): anagrafica clienti con **più destinazioni per cliente**
  (sede, magazzini, cantieri...), ciascuna richiamabile direttamente in fase di
  inserimento consegna senza doverla riscrivere.
- **Divieti mezzi pesanti** (`/restrizioni`): due sezioni distinte —
  divieti **ricorrenti** per giorno della settimana (es. "Centro storico Bergamo,
  lun-ven 8-20") che compaiono come avviso nel calendario, e blocchi di
  **indisponibilità in date specifiche** (es. "sabato 18/07 dalle 9:00 alle 22:00")
  che compaiono come veri appuntamenti in rosso nel calendario. Non esiste una
  fonte dati unica e affidabile per tutti i divieti comunali in Italia, quindi
  vanno tenuti aggiornati a mano quando cambia un'ordinanza.
- **Mezzo e scadenze** (`/scadenze`): anagrafica del camion (portata, misure
  cassone), **caricamento di libretto, e di una copia per ogni scadenza**
  (assicurazione, bollo, revisioni — PDF o foto, salvati su Cloudinary) e le
  4 scadenze richieste con relativo costo; badge di stato (verde/ambra/rosso)
  in base a quanti giorni mancano.
- **Ottimizza percorso** (`/percorso`): per una data scelta, prende tutte le
  consegne/ritiri pianificati e calcola l'ordine di tappe che minimizza i km
  totali, rispettando la portata e il volume del cassone (motore VROOM via ORS).
- **Notifiche** (`/notifiche`): imposta l'email a cui ricevere gli avvisi e i
  giorni di anticipo desiderati (es. 30, 7, 1 giorni prima). Un controllo
  automatico gira una volta al giorno lato server e invia un'email quando una
  scadenza raggiunge una di quelle soglie — nessuna app aperta necessaria.
  Pulsante "Invia email di prova" per verificare la configurazione.
- **Cruscotto** (`/`): riepilogo scadenze urgenti e prossimi impegni.

## Prossimi passi possibili (da valutare insieme)

- Autenticazione (login con email/ufficio) prima di esporre l'URL pubblicamente.
- Storico chilometraggio del mezzo (non solo l'ultimo valore).
- Stato "completata" sulle consegne con conferma e note di consegna.
- Esportazione/fattura PDF del costo di trasporto calcolato.
- Gestione multi-mezzo se in futuro si aggiunge un secondo camion.
