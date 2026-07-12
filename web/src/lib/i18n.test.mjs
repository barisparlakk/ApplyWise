import assert from "node:assert/strict";
import test from "node:test";

import { resolveLocale, translate } from "./i18n.ts";

test("selects Turkish for a Turkish browser locale", () => {
  assert.equal(resolveLocale("tr-TR,tr;q=0.9,en;q=0.8"), "tr");
});

test("selects English when it has the highest language preference", () => {
  assert.equal(resolveLocale("en-US,en;q=0.9,tr;q=0.8"), "en");
});

test("honors quality weights instead of header order", () => {
  assert.equal(resolveLocale("en-US;q=0.7,tr-TR;q=0.9"), "tr");
});

test("ignores languages with a zero quality value", () => {
  assert.equal(resolveLocale("tr-TR;q=0,en-US;q=1"), "en");
});

test("falls back to English when no language header is available", () => {
  assert.equal(resolveLocale(null), "en");
});

test("interpolates translated messages and preserves English fallbacks", () => {
  assert.equal(translate("tr", "Welcome, {name}.", { name: "Barış" }), "Hoş geldin, Barış.");
  assert.equal(translate("en", "Welcome, {name}.", { name: "Barış" }), "Welcome, Barış.");
  assert.equal(translate("tr", "Untranslated product value"), "Untranslated product value");
});
