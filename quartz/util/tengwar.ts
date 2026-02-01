/**
 * Tengwar encoding utilities for converting Quenya text to Unicode PUA.
 * Uses the tengwar npm package for Classical (Quenya) mode transcription,
 * then converts Dan Smith encoding to Unicode PUA for Tengwar Artano font.
 */

// Dan Smith encoding -> Unicode PUA mapping (CSUR/Everson proposal)
const DAN_SMITH_TO_UNICODE: Record<string, number> = {
  // Consonants
  "1": 0xe000, q: 0xe001, a: 0xe002, z: 0xe003, // tinco, parma, calma, quesse
  "2": 0xe004, w: 0xe005, s: 0xe006, x: 0xe007, // ando, umbar, anga, ungwe
  "3": 0xe008, e: 0xe009, d: 0xe00a, c: 0xe00b, // thule, formen, harma, hwesta
  "4": 0xe00c, r: 0xe00d, f: 0xe00e, v: 0xe00f, // anto, ampa, anca, unque
  "5": 0xe010, t: 0xe011, g: 0xe012, b: 0xe013, // numen, malta, noldo, nwalme
  "6": 0xe014, y: 0xe015, h: 0xe016, n: 0xe017, // ore, vala, anna, wilya
  "7": 0xe018, u: 0xe019, j: 0xe01a, m: 0xe01b, // romen, arda, lambe, alda
  "8": 0xe01c, i: 0xe01d, k: 0xe01e, ",": 0xe01f, // silme variants, esse variants
  "9": 0xe020, o: 0xe021, l: 0xe022, ".": 0xe023, // hyarmen, hwesta-sindarinwa, yanta, ure
  // Carriers & extended
  "`": 0xe025, "~": 0xe026, "]": 0xe027,
  "!": 0xe028, Q: 0xe029, A: 0xe02a, Z: 0xe02b,
  "@": 0xe02c, W: 0xe02d, S: 0xe02e, X: 0xe02f,
  // Punctuation
  "=": 0xe050, "-": 0xe051, Á: 0xe052, À: 0xe053,
  // Tehtar (vowels) - all position variants map to same Unicode
  "#": 0xe040, E: 0xe040, D: 0xe040, C: 0xe040, // a-tehta
  $: 0xe041, R: 0xe041, F: 0xe041, V: 0xe041, // e-tehta
  "%": 0xe042, T: 0xe042, G: 0xe042, B: 0xe042, // i-tehta
  "^": 0xe043, Y: 0xe043, H: 0xe043, N: 0xe043, // o-tehta
  "&": 0xe044, U: 0xe044, J: 0xe044, M: 0xe044, // u-tehta
}

/** Convert Dan Smith encoded text to Unicode PUA */
export function danSmithToUnicode(text: string): string {
  return [...text]
    .map((c) =>
      c === " " ? " " : DAN_SMITH_TO_UNICODE[c] ? String.fromCodePoint(DAN_SMITH_TO_UNICODE[c]) : c,
    )
    .join("")
}

/** Namárië lines: [Quenya, English] */
export const NAMARIE_LINES: [string, string][] = [
  ["Ai laurie lantar lassi surinen", "Ah! like gold fall the leaves in the wind,"],
  ["yeni unotime ve ramar aldaron", "long years numberless as the wings of trees!"],
  ["yeni ve linte yuldar avanier", "The years have passed like swift draughts"],
  ["mi oromardi lisse miruvóreva", "of the sweet mead in lofty halls beyond the West,"],
  ["Andune pella Vardo tellumar nu luini", "beneath the blue vaults of Varda"],
  ["yassen tintilar i eleni", "wherein the stars tremble"],
  ["omaryo airetari lirinen", "in the song of her voice, holy and queenly."],
  ["Si man i yulma nin enquantuva", "Who now shall refill the cup for me?"],
  ["An si Tintalle Varda Oiolosseo", "For now the Kindler, Varda, the Queen of the Stars,"],
  ["ve fanyar maryat Elentari ortane", "from Mount Everwhite has uplifted her hands like clouds,"],
  ["ar ilye tier undulave lumbule", "and all paths are drowned deep in shadow;"],
  ["ar sindanoriello caita mornie", "and out of a grey country darkness lies"],
  ["i falmalinnar imbe met", "on the foaming waves between us,"],
  ["ar hisie untupa Calaciryo miri oiale", "and mist covers the jewels of Calacirya for ever."],
  ["Si vanwa na Romello vanwa Valimar", "Now lost, lost to those from the East is Valimar!"],
  ["Namarie nai hiruvalye Valimar", "Farewell! Maybe thou shalt find Valimar."],
  ["Nai elye hiruva Namarie", "Maybe even thou shalt find it. Farewell!"],
]
