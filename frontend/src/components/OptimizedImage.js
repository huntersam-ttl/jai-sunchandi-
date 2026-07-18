const DEFAULT_WIDTHS = [320, 480, 768, 1024, 1280];
const SUPABASE_PUBLIC_OBJECT_PATH = "/storage/v1/object/public/";
const SUPABASE_PUBLIC_RENDER_PATH = "/storage/v1/render/image/public/";

function getProvider(src) {
  try {
    const url = new URL(src);
    if (url.hostname === "images.unsplash.com") {
      return "unsplash";
    }
    if (url.pathname.includes(SUPABASE_PUBLIC_OBJECT_PATH)) {
      return "supabase";
    }
  } catch {
    return null;
  }
  return null;
}

function transformUrl(src, width, format, quality, provider) {
  const url = new URL(src);
  if (provider === "supabase") {
    url.pathname = url.pathname.replace(SUPABASE_PUBLIC_OBJECT_PATH, SUPABASE_PUBLIC_RENDER_PATH);
    url.searchParams.set("width", String(width));
    url.searchParams.set("quality", String(quality));
    url.searchParams.set("resize", "cover");
    return url.toString();
  }

  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality));
  url.searchParams.set("fm", format);
  url.searchParams.set("auto", "format");
  return url.toString();
}

function srcSet(src, widths, format, quality, provider) {
  return widths.map((width) => `${transformUrl(src, width, format, quality, provider)} ${width}w`).join(", ");
}

export function OptimizedImage({
  src,
  alt,
  className = "",
  widths = DEFAULT_WIDTHS,
  sizes = "100vw",
  loading = "lazy",
  fetchPriority,
  quality = 72,
  fallbackQuality = 76,
  testId,
}) {
  const provider = src ? getProvider(src) : null;
  if (!src || !provider) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        data-testid={testId}
      />
    );
  }

  const largest = widths[widths.length - 1];
  if (provider === "supabase") {
    return (
      <picture>
        <source type="image/webp" srcSet={srcSet(src, widths, "webp", quality, provider)} sizes={sizes} />
        <img
          src={transformUrl(src, largest, "origin", fallbackQuality, provider)}
          alt={alt}
          className={className}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          data-testid={testId}
        />
      </picture>
    );
  }

  return (
    <picture>
      <source type="image/webp" srcSet={srcSet(src, widths, "webp", quality, provider)} sizes={sizes} />
      <source type="image/jpeg" srcSet={srcSet(src, widths, "jpg", fallbackQuality, provider)} sizes={sizes} />
      <img
        src={transformUrl(src, largest, "jpg", fallbackQuality, provider)}
        alt={alt}
        className={className}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        data-testid={testId}
      />
    </picture>
  );
}
