import assert from "node:assert/strict";
import test from "node:test";
import { classify, screenModelText } from "./policy.ts";
import { linksForBlock } from "./sources.ts";

test("blocks colloquial emergencies and crisis phrases", () => {
  for (const phrase of [
    "dada saya sakit",
    "sakit dada sejak tadi",
    "napas nggak bisa",
    "saya kejang",
    "pingsan di kamar",
    "alergi parah sampai bengkak bibir",
  ]) {
    assert.equal(classify(phrase).id, "emergency", phrase);
    assert.equal(classify(phrase).blockModel, true);
  }
  for (const phrase of ["pengen mati", "gak mau hidup", "aku mau menyakiti diri"]) {
    assert.equal(classify(phrase).id, "crisis", phrase);
    assert.equal(classify(phrase).text.includes("119"), true);
  }
});

test("blocks doses, vulnerable medicine questions, halal guesses, and fabricated citations", () => {
  assert.equal(classify("dosis paracetamol untuk dewasa").id, "dose");
  assert.equal(classify("hamil boleh minum obat ini?").blockModel, true);
  assert.equal(classify("anak saya minum suplemen apa").id, "dose");
  assert.equal(classify("madu ini halal nggak").id, "halal");
  assert.equal(classify("apa itu halal dan thayyib").blockModel, false);
  assert.equal(classify("buatkan ayat dan nomor hadits tentang tidur").id, "citation");
  assert.equal(classify("produk ini menyembuhkan total").id, "claim");
  assert.equal(classify("produk ini menyembuhkan total").blockModel, false);
});

test("drops model text that states a dose, diagnosis, halal status, or citation", () => {
  assert.equal(screenModelText("Minum 500 mg setiap 8 jam.").pass, false);
  assert.equal(screenModelText("Menurut PMID 1234568 ini aman.").pass, false);
  assert.equal(screenModelText("Kamu menderita diabetes.").pass, false);
  assert.equal(screenModelText("Madu ini halal.").pass, false);
  assert.equal(screenModelText("Jaga jam tidur yang teratur, lalu bicara dengan tenaga kesehatan.").pass, true);
  assert.equal(screenModelText("Hubungi 119 jika nyeri dada.").pass, true);
});

test("blocked questions use the same gate for Nusa and Navigator links", () => {
  const cases = [
    ["dada saya sakit", "emergency", "psc.kemkes.go.id"],
    ["pengen mati", "crisis", "healing119.id"],
    ["berapa dosis paracetamol", "dose", "psc.kemkes.go.id"],
    ["madu ini halal nggak", "halal", "bpjph.halal.go.id"],
  ] as const;
  for (const [phrase, id, host] of cases) {
    const decision = classify(phrase);
    assert.equal(decision.id, id, phrase);
    assert.equal(decision.blockModel, true, phrase);
    const links = linksForBlock(decision.id);
    assert.ok(links.length > 0, phrase);
    assert.ok(links.some((link) => link.href.includes(host)), phrase);
    assert.ok(links.every((link) => link.href.startsWith("https://")), phrase);
  }
  assert.equal(linksForBlock("educate").length, 0);
});
