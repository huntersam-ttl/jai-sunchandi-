import { useEffect } from "react";

const DEFAULT_TITLE = "Jai Supa Deurali Sun-Chandi Pasal";

function setMetaTag(name, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

/**
 * Sets document title + meta description for the current page (CRA has no
 * server-side rendering, so this is a client-side title/meta swap rather
 * than true per-route SSR meta -- still the standard approach for a CRA SPA
 * and what crawlers that execute JS will see).
 */
export function useDocumentMeta(title, description) {
  useEffect(() => {
    const previousTitle = document.title;
    const previousDescription = document.querySelector('meta[name="description"]')?.getAttribute("content");
    if (title) document.title = title;
    if (description) setMetaTag("description", description);
    return () => {
      document.title = previousTitle || DEFAULT_TITLE;
      if (previousDescription) setMetaTag("description", previousDescription);
    };
  }, [title, description]);
}

/** Injects/replaces a single JSON-LD <script> tag, keyed by id, so multiple
 * pages/components can each own their own structured-data block without
 * clobbering one another. */
export function useJsonLd(id, data) {
  useEffect(() => {
    if (!data) return;
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
    return () => { el?.remove(); };
  }, [id, data]);
}
