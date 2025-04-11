import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import HeatMap from './component/heat-map.tsx'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HeatMap />
  </StrictMode>,
)
