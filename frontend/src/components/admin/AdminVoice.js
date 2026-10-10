import { useEffect, useState } from "react";
import { api } from "@/lib/api";
export default function AdminVoice({ src }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true, objectUrl;
    setUrl(""); setError(false);
    api.get(src, { responseType: "blob" }).then(({data}) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(data); setUrl(objectUrl);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);
  return <div className="mt-3 rounded-md bg-[#FFFDF7] p-3" data-testid="admin-voice-note">
    <p className="mb-2 text-xs font-semibold text-[#5B0D18]">Customer voice note</p>
    {error ? <p className="text-xs text-red-700">Audio unavailable</p> : url ? <audio controls preload="metadata" src={url} className="w-full" /> : <p className="text-xs">Loading…</p>}
  </div>;
}
