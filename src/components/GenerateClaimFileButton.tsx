import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { fetchClaimFileData } from '../lib/fetchClaimFileData';
import { printClaimFile } from '../lib/printClaimFile';

const ALLOWED_ROLES = ['insurance_desk', 'billing', 'admin'];

export function GenerateClaimFileButton({ visitId }: { visitId: string }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return null;

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClaimFileData(visitId);
      printClaimFile(data);
    } catch (e: any) {
      setError(e.message ?? 'Could not generate claim file.');
    }
    setLoading(false);
  };

  return (
    <div>
      <button className="btn btn-secondary" onClick={generate} disabled={loading}>
        {loading ? 'Preparing…' : 'Generate Claim File'}
      </button>
      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}
