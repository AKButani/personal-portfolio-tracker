import { Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import InstrumentPage from './pages/InstrumentPage'
import ManagePage from './pages/ManagePage'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/instrument/:ticker" element={<InstrumentPage />} />
      <Route path="/manage" element={<ManagePage />} />
    </Routes>
  )
}
