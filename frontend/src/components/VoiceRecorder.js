import { useEffect, useRef, useState } from "react";
const MAX_BYTES = 2 * 1024 * 1024;
const MIME_TYPES = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"];
export default function VoiceRecorder({ value, onChange }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorder = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const [preview, setPreview] = useState("");
  const stop = () => {
    clearInterval(timer.current);
    timer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setRecording(false);
  };
  useEffect(() => () => {
    clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => {
    if (!value) { setPreview(""); return; }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);
  const start = async () => {
    if (recording) return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording is unavailable here; attach an audio file instead."); return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const type = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
      if (!type) { s.getTracks().forEach((t) => t.stop()); setError("Audio format unavailable; attach a file instead."); return; }
      const chunks = [];
      const rec = new MediaRecorder(s, { mimeType: type });
      recorder.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onerror = () => { setError("Recording failed. Please try attaching an audio file."); stop(); };
      rec.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type });
        if (blob.size > MAX_BYTES) { setError("Recording exceeds 2 MB. Make it shorter."); return; }
        if (blob.size) onChange(new File([blob], "voice-note", { type }));
      };
      rec.start(1000);
      setSeconds(0);
      setRecording(true);
      let elapsed = 0;
      timer.current = setInterval(() => { elapsed += 1; setSeconds(elapsed); if (elapsed >= 60) stop(); }, 1000);
    } catch { setError("Microphone permission was denied. Attach an audio file instead."); }
  };
  const attach = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!MIME_TYPES.includes(file.type) || !file.size || file.size > MAX_BYTES) { setError("Select a WebM, M4A, MP3 or OGG file under 2 MB."); return; }
    setError(""); onChange(file);
  };
  return <div className="rounded-md border border-[#D4AF37]/40 bg-[#FFFDF7] p-4 space-y-3" data-testid="voice-note-recorder">
    <p className="font-semibold text-[#5B0D18]">Voice note (optional)</p>
    <p className="text-xs text-[#5F5147]">Describe your order or problem in Nepali or English. Record up to 60 seconds (2 MB maximum). Only the shop can listen.</p>
    <div className="flex flex-wrap items-center gap-3">
      {recording ? <button type="button" onClick={stop} className="min-h-[44px] rounded bg-red-700 px-4 text-sm text-white">Stop · {seconds}s</button>
        : <button type="button" onClick={start} className="min-h-[44px] rounded bg-[#5B0D18] px-4 text-sm text-white">Record voice</button>}
      <label className="text-sm">Or attach audio<input type="file" accept="audio/webm,audio/mp4,audio/mpeg,audio/ogg,.mp3,.m4a" onChange={attach} className="mt-1 block max-w-full text-xs" /></label>
    </div>
    {preview && <><audio src={preview} controls className="w-full" aria-label="Review voice note"/><button type="button" onClick={()=>onChange(null)} className="min-h-[44px] text-sm text-red-700 underline">Remove recording</button></>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
