import { StrictMode } from 'react'
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LicenseGate } from './components/Auth/LicenseGate'
import type { LicenseCache } from './config/firebase'

const LICENSE_CACHE_KEY = 'securits_license_cache'
const LICENSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000

const readLicenseCache = (): LicenseCache | null => {
  const raw = localStorage.getItem(LICENSE_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as LicenseCache;
    if (!parsed?.key || !parsed?.client || typeof parsed.validatedAt !== 'number') {
      return null;
    }

    if (Date.now() - parsed.validatedAt > LICENSE_CACHE_TTL_MS) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

function Root() {
  const [licenseCache, setLicenseCache] = useState<LicenseCache | null>(() => readLicenseCache());

  if (!licenseCache) {
    return <LicenseGate onValidated={setLicenseCache} />;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
