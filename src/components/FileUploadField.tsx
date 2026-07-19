import { useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Props {
  value: string | null | undefined; // stores the public URL, same as before
  onChange: (url: string | null) => void;
  folder: string; // e.g. table name, used to namespace storage paths
}

const MAX_SIZE_MB = 15;

export function FileUploadField({ value, onChange, folder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pathFromUrl = (url: string): string | null => {
    const marker = '/attachments/';
    const idx = url.indexOf(marker);
    return idx === -1 ? null : url.slice(idx + marker.length);
  };

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File is larger than ${MAX_SIZE_MB}MB.`);
      return;
    }
    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${folder}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file, { upsert: false });
    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }
    // Replacing an existing file — clean up the old object now that the new one is confirmed uploaded.
    if (value) {
      const oldPath = pathFromUrl(value);
      if (oldPath) await supabase.storage.from('attachments').remove([oldPath]);
    }
    setUploading(false);
    const { data } = supabase.storage.from('attachments').getPublicUrl(path);
    onChange(data.publicUrl);
  };

  const handleRemove = async () => {
    if (value) {
      const oldPath = pathFromUrl(value);
      if (oldPath) await supabase.storage.from('attachments').remove([oldPath]);
    }
    onChange(null);
  };

  const fileName = value ? decodeURIComponent(value.split('/').pop() ?? 'file').replace(/^[0-9a-f-]{36}-/, '') : null;
  const isImage = value ? /\.(png|jpe?g|gif|webp)$/i.test(value) : false;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      {!value && (
        <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : 'Choose file to upload'}
        </button>
      )}

      {value && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {isImage && <img src={value} alt="" style={{ width: 48, height: 48, objectFit: 'cover', border: '1px solid var(--color-divider)' }} />}
          <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>{fileName}</a>
          <button type="button" className="btn btn-ghost" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Replace'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleRemove}>Remove</button>
        </div>
      )}

      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}
