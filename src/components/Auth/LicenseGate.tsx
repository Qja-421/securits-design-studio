import React, { useState } from 'react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { CheckCircle2, KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { db, LicenseCache, LicenseRecord } from '../../config/firebase';

interface LicenseGateProps {
  onValidated: (cache: LicenseCache) => void;
}

const toDate = (value: LicenseRecord['expirationDate']) => {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value);
};

export const LicenseGate: React.FC<LicenseGateProps> = ({ onValidated }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success' | ''>('');

  const handleValidate = async () => {
    const trimmedKey = licenseKey.trim();
    if (!trimmedKey) {
      setMessageType('error');
      setMessage('Saisissez une clé de licence');
      return;
    }

    setLoading(true);
    setMessage('');
    setMessageType('');

    try {
      const snapshot = await getDoc(doc(db, 'licenses', trimmedKey));

      if (!snapshot.exists()) {
        setMessageType('error');
        setMessage('Clé de licence invalide');
        return;
      }

      const data = snapshot.data() as LicenseRecord;
      const expirationDate = toDate(data.expirationDate);
      const now = new Date();

      if (data.status !== 'active') {
        setMessageType('error');
        setMessage('Licence expirée ou suspendue');
        return;
      }

      if (expirationDate.getTime() < now.getTime()) {
        setMessageType('error');
        setMessage('Licence expirée');
        return;
      }

      const cache = {
        key: trimmedKey,
        client: data.client,
        validatedAt: Date.now()
      };

      localStorage.setItem('securits_license_cache', JSON.stringify(cache));
      setMessageType('success');
      setMessage(`Licence validée pour ${data.client}`);
      onValidated(cache);
    } catch (error) {
      console.error('License validation failed:', error);
      setMessageType('error');
      setMessage('Impossible de vérifier la licence');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-[#C8860A]/35 bg-gradient-to-br from-[#1A1F2E] to-[#0F1419] shadow-[0_24px_80px_rgba(0,0,0,0.45)] overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#C8860A] to-brand-orange" />

        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#C8860A]/60 bg-black/20 text-[#C8860A] shadow-[0_8px_24px_rgba(200,134,10,0.2)]">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C8860A]">Accès sécurisé</div>
              <h1 className="text-xl font-bold text-white">Licence Securits Tech</h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-gray-300">
            Saisissez votre clé de licence pour accéder à l’application.
          </p>

          <div className="mt-6 space-y-3">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Clé de licence
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 focus-within:border-[#C8860A]/70">
              <KeyRound size={16} className="text-[#C8860A] shrink-0" />
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleValidate();
                }}
                placeholder="SECURITS-2026-XXXX"
                className="w-full bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <button
              onClick={handleValidate}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#C8860A] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#b87708] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              <span>{loading ? 'Vérification...' : 'Valider'}</span>
            </button>

            {message && (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  messageType === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-red-500/30 bg-red-500/10 text-red-200'
                }`}
              >
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
