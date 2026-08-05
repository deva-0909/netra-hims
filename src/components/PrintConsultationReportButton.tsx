import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import type { ModuleConfig } from '../modules/fieldTypes';
import { fetchConsultationReportData } from '../lib/fetchConsultationReportData';
import { printConsultationReport } from '../lib/printConsultationReport';

const ALLOWED_ROLES = ['doctor', 'optometrist', 'nurse', 'admin'];

export function PrintConsultationReportButton({ visitId, moduleConfig }: { visitId: string; moduleConfig: ModuleConfig }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return null;

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConsultationReportData(visitId, moduleConfig);
      printConsultationReport(data);
    } catch (e: any) {
      setError(e.message ?? 'Could not generate consultation report.');
    }
    setLoading(false);
  };

  return (
    <div>
      <button className="btn btn-secondary" onClick={generate} disabled={loading}>
        {loading ? 'Preparing…' : 'Print Consultation Report'}
      </button>
      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}
