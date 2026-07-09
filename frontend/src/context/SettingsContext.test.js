// SettingsContext.js imports the api client via the "@/" alias, which CRA's
// Jest config doesn't resolve (same constraint as every other test file in
// this app) -- a virtual mock sidesteps that without needing any api
// behavior for this pure-function test.
jest.mock("@/lib/api", () => ({ api: { get: jest.fn(() => Promise.resolve({ data: {} })) } }), { virtual: true });

import { waLinkFromSettings } from "./SettingsContext";

describe("waLinkFromSettings", () => {
  test("returns null when no whatsapp number is configured (never a broken wa.me link)", () => {
    expect(waLinkFromSettings({ whatsapp: "" }, "hello")).toBeNull();
    expect(waLinkFromSettings({}, "hello")).toBeNull();
  });
  test("builds a wa.me link when a number is configured", () => {
    const link = waLinkFromSettings({ whatsapp: "9779812345678" }, "hello");
    expect(link).toBe("https://wa.me/9779812345678?text=hello");
  });
});
