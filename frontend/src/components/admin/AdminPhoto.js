import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Image as ImageIcon, Loader2, RefreshCw } from "lucide-react";

/**
 * Renders a private admin photo served through our own backend proxy
 * (never a Supabase signed URL -- see backend/admin_routes.py's
 * _download_storage_object for why). A plain <img src> can't carry the
 * admin's Bearer token, so this fetches the bytes via the authenticated
 * axios client and renders them as a local blob URL.
 */
export default function AdminPhoto({ src, alt = "", className = "", testId, onReady }) {
  const [state, setState] = useState(src ? "loading" : "empty");
  const [blobUrl, setBlobUrl] = useState(null);
  const objectUrlRef = useRef(null);

  const load = () => {
    if (!src) { setState("empty"); return; }
    setState("loading");
    api.get(src, { responseType: "blob" })
      .then((r) => {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const obj = URL.createObjectURL(r.data);
        objectUrlRef.current = obj;
        setBlobUrl(obj);
        setState("ready");
        onReady?.(obj);
      })
      .catch((err) => {
        console.error("Admin photo load failed:", err);
        setState("error");
      });
  };

  useEffect(() => {
    load();
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, [src]); // eslint-disable-line

  if (state === "empty") {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${className}`} data-testid={testId}>
        <ImageIcon className="text-slate-300" size={24} />
      </div>
    );
  }
  if (state === "loading") {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${className}`} data-testid={testId ? `${testId}-loading` : undefined}>
        <Loader2 className="text-slate-300 animate-spin" size={20} />
      </div>
    );
  }
  if (state === "error") {
    return (
      <button type="button" onClick={load}
        className={`flex flex-col items-center justify-center gap-1 bg-slate-100 text-slate-400 hover:text-slate-600 ${className}`}
        data-testid={testId ? `${testId}-error` : undefined}>
        <RefreshCw size={16} /> <span className="text-xs">Retry</span>
      </button>
    );
  }
  return <img src={blobUrl} alt={alt} className={className} data-testid={testId} />;
}
