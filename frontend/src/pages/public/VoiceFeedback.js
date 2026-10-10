import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { uploadVoiceNote } from "@/lib/storage";
import VoiceRecorder from "@/components/VoiceRecorder";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { PUBLIC_BRAND_NAME } from "@/lib/brand";
import { Field, inputCls } from "./CustomOrder";
export default function VoiceFeedback() {
  useDocumentMeta(`Voice Feedback – ${PUBLIC_BRAND_NAME}`, "Send a private voice message about jewellery orders, repairs or service.");
  const [params] = useSearchParams();
  const [form, setForm] = useState(() => ({ name: "", phone: "", notes: "", item_type: params.get("order_number") || "" }));
  const [voiceFile, setVoiceFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (key) => (e) => setForm((prev)=>({...prev,[key]:e.target.value}));
  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    if (!form.name.trim() || !form.phone.trim() || (!voiceFile && !form.notes.trim())) {
      toast.error("Enter your name, phone, and a message or voice note."); return;
    }
    setSending(true);
    try {
      const voice_note_path = voiceFile ? await uploadVoiceNote(voiceFile) : "";
      await api.post("/leads", { ...form, lead_type: "feedback", voice_note_path });
      setSent(true);
    } catch (err) { toast.error(apiError(err)); } finally { setSending(false); }
  };
  if (sent) return <div className="brand-shell max-w-xl py-24 text-center"><h1 className="font-serif-display text-3xl font-bold">Thank you for your feedback</h1><p className="mt-3">Your message has been sent privately to the shop.</p></div>;
  return <div className="brand-shell max-w-xl py-12 sm:py-16">
    <p className="brand-eyebrow">Customer feedback</p>
    <h1 className="font-serif-display mt-3 text-4xl font-bold">Leave a voice message</h1>
    <p className="mt-4 text-sm text-[#5F5147]">Tell us about an order, repair, jewellery problem, or shop experience.</p>
    <form onSubmit={submit} className="brand-card mt-8 space-y-4 rounded-md p-5 sm:p-6">
      <Field label="Name *"><input className={inputCls} required value={form.name} onChange={set("name")}/></Field>
      <Field label="Phone *"><input className={inputCls} required value={form.phone} onChange={set("phone")}/></Field>
      <Field label="Order number (optional)"><input className={inputCls} value={form.item_type} onChange={set("item_type")} placeholder="ORD-0001"/></Field>
      <Field label="Message (optional with recording)"><textarea rows={3} className={inputCls} value={form.notes} onChange={set("notes")}/></Field>
      <VoiceRecorder value={voiceFile} onChange={setVoiceFile}/>
      <p className="text-xs text-[#5F5147]">By submitting audio, you consent to the shop storing and listening to it to handle your enquiry. Do not include payment or identity secrets.</p>
      <button type="submit" disabled={sending} className="min-h-[52px] w-full rounded-md bg-[#5B0D18] text-white disabled:opacity-50">{sending ? "Sending…" : "Send feedback"}</button>
    </form>
  </div>;
}
