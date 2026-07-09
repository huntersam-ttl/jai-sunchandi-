import { primaryProductPhoto, PRODUCT_PLACEHOLDER_IMG } from "./format";

describe("primaryProductPhoto", () => {
  test("returns the product's own first photo when it has one", () => {
    const product = { photos: ["https://example.com/real-photo.jpg", "https://example.com/second.jpg"] };
    expect(primaryProductPhoto(product)).toBe("https://example.com/real-photo.jpg");
  });

  test("falls back to the shared placeholder when photos is empty", () => {
    expect(primaryProductPhoto({ photos: [] })).toBe(PRODUCT_PLACEHOLDER_IMG);
  });

  test("falls back to the shared placeholder when photos is missing", () => {
    expect(primaryProductPhoto({})).toBe(PRODUCT_PLACEHOLDER_IMG);
  });

  test("handles a null/undefined product without crashing", () => {
    expect(primaryProductPhoto(null)).toBe(PRODUCT_PLACEHOLDER_IMG);
    expect(primaryProductPhoto(undefined)).toBe(PRODUCT_PLACEHOLDER_IMG);
  });
});
