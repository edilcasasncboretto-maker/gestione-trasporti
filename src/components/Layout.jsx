import { NavLink, Outlet } from 'react-router-dom'

const voci = [
  { to: '/', label: 'Cruscotto', fine: true },
  { to: '/calendario', label: 'Calendario' },
  { to: '/nuova-consegna', label: 'Nuova consegna/ritiro' },
  { to: '/percorso', label: 'Ottimizza percorso' },
  { to: '/clienti', label: 'Clienti' },
  { to: '/restrizioni', label: 'Divieti mezzi pesanti' },
  { to: '/scadenze', label: 'Mezzo e scadenze' },
]

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">
          Trasporti<span className="puntino">.</span>
        </div>
        <nav>
          {voci.map((v) => (
            <NavLink
              key={v.to}
              to={v.to}
              end={v.fine}
              className={({ isActive }) => (isActive ? 'attivo' : '')}
            >
              {v.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  )
}
