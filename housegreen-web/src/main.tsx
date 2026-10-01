import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { AlertsProvider } from './context/AlertsContext'
import { PropertiesProvider } from './context/PropertiesContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PropertiesProvider>
          <FavoritesProvider>
            <AlertsProvider>
              <App />
            </AlertsProvider>
          </FavoritesProvider>
        </PropertiesProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)