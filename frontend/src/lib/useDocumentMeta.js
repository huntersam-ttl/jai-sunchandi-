import { useEffect } from "react";
import { DEFAULT_LOGO_PATH, PUBLIC_BRAND_NAME } from "@/lib/brand";

const DEFAULT_TITLE = PUBLIC_BRAND_NAME;

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

function setPropertyTag(property, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setCanonical(url) {
  if (!url) return;
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}

/**
 * Sets document title + meta description for the current page (CRA has no
 * server-side rendering, so this is a client-side title/meta swap rather
 * than true per-route SSR meta -- still the standard approach for a CRA SPA
 * and what crawlers that execute JS will see).
 */
export function useDocumentMeta(title, description, options = {}) {
  useEffect(() => {
    const previousTitle = document.title;
    const previousDescription = document.querySelector('meta[name="description"]')?.getAttribute("content");
    const previousCanonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
    const canonical = options.canonical || `${window.location.origin}${window.location.pathname}`;
    const image = options.image || `${window.location.origin}${DEFAULT_LOGO_PATH}`;
    if (title) document.title = title;
    if (description) setMetaTag("description", description);
    setCanonical(canonical);
    setPropertyTag("og:title", title || DEFAULT_TITLE);
    setPropertyTag("og:description", description);
    setPropertyTag("og:type", options.type || "website");
    setPropertyTag("og:url", canonical);
    setPropertyTag("og:image", image);
    setMetaTag("twitter:card", "summary_large_image");
    setMetaTag("twitter:title", title || DEFAULT_TITLE);
    setMetaTag("twitter:description", description);
    setMetaTag("twitter:image", image);
    return () => {
      document.title = previousTitle || DEFAULT_TITLE;
      if (previousDescription) setMetaTag("description", previousDescription);
      if (previousCanonical) setCanonical(previousCanonical);
    };
  }, [title, description, options.canonical, options.image, options.type]);
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
