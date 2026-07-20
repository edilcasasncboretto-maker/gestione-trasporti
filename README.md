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

## 2. Ottieni la API key gratuita di OpenRouteService

1. Registrati su https://openrouteservice.org/dev/#/signup
2. Crea una API key gratuita (piano "free", limiti ampi per uso da ufficio singolo).

## 3. Configura le variabili d'ambiente

Copia `.env.example` in `.env` e compila tutti i valori (config Firebase, API
key ORS, indirizzo del tuo deposito/magazzino — è il punto di partenza/arrivo
usato per i calcoli di andata/ritorno).

```
cp .env.example .env
```

## 4. Avvio in locale

```
npm install
npm run dev
```

## 5. Carica su GitHub

```
git init
git add .
git commit -m "Primo scaffold gestione trasporti"
gh repo create gestione-trasporti --private --source=. --push
```

(oppure crea il repo dall'interfaccia GitHub e collega il remote con `git remote add origin ...`)

## 6. Deploy su Vercel

1. Vai su https://vercel.com → **Add New → Project** → importa il repo GitHub appena creato.
2. Framework rilevato automaticamente: **Vite**.
3. In **Environment Variables**, incolla tutte le chiavi presenti nel tuo `.env` (Vercel non legge il file `.env`, vanno inserite manualmente nel pannello).
4. Deploy. Ad ogni push su GitHub, Vercel aggiorna automaticamente l'app.

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
  quel giorno.
- **Nuova consegna/ritiro** (`/nuova-consegna`, e `/modifica-consegna/:id` per
  modificare un impegno esistente): form che geocodifica l'indirizzo, calcola i
  km stradali di andata dal deposito (profilo mezzo pesante), mostra la mappa
  col tracciato e calcola il costo da addebitare (km andata+ritorno × costo/km,
  arrotondato per eccesso a multipli di 5 €). Puoi selezionare un cliente già
  salvato in anagrafica per compilare automaticamente nome e indirizzo.
  **Il percorso sulla mappa è modificabile a mano**: clicca per aggiungere un
  punto di passaggio, trascinalo per spostarlo, click destro per rimuoverlo,
  poi premi "Ricalcola" per aggiornare km e costo — utile quando il calcolo
  automatico non stima bene una strada percorribile dal camion.
- **Clienti** (`/clienti`): anagrafica clienti (nome, indirizzo, referente,
  telefono, note) da richiamare direttamente in fase di inserimento consegna.
- **Divieti mezzi pesanti** (`/restrizioni`): qui inserisci manualmente i
  divieti di transito che conosci (zona, giorni della settimana, orario,
  soglia in quintali) — compaiono poi come avviso nel calendario. Non esiste
  una fonte dati unica e affidabile per tutti i divieti comunali in Italia,
  quindi vanno tenuti aggiornati a mano quando cambia un'ordinanza.
- **Mezzo e scadenze** (`/scadenze`): anagrafica del camion (portata, misure
  cassone) e le 4 scadenze richieste con relativo costo; badge di stato
  (verde/ambra/rosso) in base a quanti giorni mancano.
- **Ottimizza percorso** (`/percorso`): per una data scelta, prende tutte le
  consegne/ritiri pianificati e calcola l'ordine di tappe che minimizza i km
  totali, rispettando la portata e il volume del cassone (motore VROOM via ORS).
- **Cruscotto** (`/`): riepilogo scadenze urgenti e prossimi impegni.

## Prossimi passi possibili (da valutare insieme)

- Autenticazione (login con email/ufficio) prima di esporre l'URL pubblicamente.
- Storico chilometraggio del mezzo (non solo l'ultimo valore).
- Notifiche automatiche (email) per le scadenze, non solo badge in app.
- Stato "completata" sulle consegne con conferma e note di consegna.
- Esportazione/fattura PDF del costo di trasporto calcolato.
- Gestione multi-mezzo se in futuro si aggiunge un secondo camion.
