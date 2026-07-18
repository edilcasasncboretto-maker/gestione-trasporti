import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Calendario from './pages/Calendario'
import NuovaConsegna from './pages/NuovaConsegna'
import Percorso from './pages/Percorso'
import Scadenze from './pages/Scadenze'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="calendario" element={<Calendario />} />
          <Route path="nuova-consegna" element={<NuovaConsegna />} />
          <Route path="percorso" element={<Percorso />} />
          <Route path="scadenze" element={<Scadenze />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
