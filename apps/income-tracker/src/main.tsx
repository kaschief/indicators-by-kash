import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import IncomeTracker from './IncomeTracker'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IncomeTracker />
  </StrictMode>,
)
