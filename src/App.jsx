import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Calendario from './pages/Calendario'
import ConsegnaForm from './pages/ConsegnaForm'
import Percorso from './pages/Percorso'
import Scadenze from './pages/Scadenze'
import Clienti from './pages/Clienti'
import Restrizioni from './pages/Restrizioni'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="calendario" element={<Calendario />} />
          <Route path="nuova-consegna" element={<ConsegnaForm />} />
          <Route path="modifica-consegna/:id" element={<ConsegnaForm />} />
          <Route path="percorso" element={<Percorso />} />
          <Route path="scadenze" element={<Scadenze />} />
          <Route path="clienti" element={<Clienti />} />
          <Route path="restrizioni" element={<Restrizioni />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
