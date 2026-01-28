// Convert Dan Smith encoding (used by Tengwar Annatar) to Unicode PUA (used by Tengwar Artano)

// Direct Dan Smith character -> Unicode PUA mapping
// Based on the tengwar npm package dan-smith.js and CSUR/Everson proposal
const danSmithToUnicode = {
    // Tengwar consonants (primary)
    "1": 0xE000, // tinco
    "q": 0xE001, // parma
    "a": 0xE002, // calma
    "z": 0xE003, // quesse
    "2": 0xE004, // ando
    "w": 0xE005, // umbar
    "s": 0xE006, // anga
    "x": 0xE007, // ungwe
    "3": 0xE008, // thule
    "e": 0xE009, // formen
    "d": 0xE00A, // harma
    "c": 0xE00B, // hwesta
    "4": 0xE00C, // anto
    "r": 0xE00D, // ampa
    "f": 0xE00E, // anca
    "v": 0xE00F, // unque
    "5": 0xE010, // numen
    "t": 0xE011, // malta
    "g": 0xE012, // noldo
    "b": 0xE013, // nwalme
    "6": 0xE014, // ore
    "y": 0xE015, // vala
    "h": 0xE016, // anna
    "n": 0xE017, // wilya
    "7": 0xE018, // romen
    "u": 0xE019, // arda
    "j": 0xE01A, // lambe
    "m": 0xE01B, // alda
    "8": 0xE01C, // silme
    "i": 0xE01D, // silme-nuquerna
    "k": 0xE01E, // esse
    ",": 0xE01F, // esse-nuquerna
    "9": 0xE020, // hyarmen
    "o": 0xE021, // hwesta-sindarinwa
    "l": 0xE022, // yanta
    ".": 0xE023, // ure
    // Carriers
    "`": 0xE025, // short-carrier
    "~": 0xE026, // long-carrier
    "]": 0xE027, // round-carrier (telco?)
    // Extended tengwar
    "!": 0xE028, // tinco-extended
    "Q": 0xE029, // parma-extended
    "A": 0xE02A, // calma-extended
    "Z": 0xE02B, // quesse-extended
    "@": 0xE02C, // ando-extended
    "W": 0xE02D, // umbar-extended
    "S": 0xE02E, // anga-extended
    "X": 0xE02F, // ungwe-extended
    // Punctuation
    "=": 0xE050, // comma/pusta
    "-": 0xE051, // full-stop
    "Á": 0xE052, // exclamation
    "À": 0xE053, // question
    // Tehtar (vowels) - using first position for all variants
    "#": 0xE040, // a-tehta
    "E": 0xE040, // a-tehta (alt position)
    "D": 0xE040, // a-tehta (alt position)
    "C": 0xE040, // a-tehta (alt position)
    "$": 0xE041, // e-tehta
    "R": 0xE041, // e-tehta (alt position)
    "F": 0xE041, // e-tehta (alt position)
    "V": 0xE041, // e-tehta (alt position)
    "%": 0xE042, // i-tehta
    "T": 0xE042, // i-tehta (alt position)
    "G": 0xE042, // i-tehta (alt position)
    "B": 0xE042, // i-tehta (alt position)
    "^": 0xE043, // o-tehta
    "Y": 0xE043, // o-tehta (alt position)
    "H": 0xE043, // o-tehta (alt position)
    "N": 0xE043, // o-tehta (alt position)
    "&": 0xE044, // u-tehta
    "U": 0xE044, // u-tehta (alt position)
    "J": 0xE044, // u-tehta (alt position)
    "M": 0xE044, // u-tehta (alt position)
};

function convertToUnicode(danSmithText) {
    let result = '';
    for (const char of danSmithText) {
        if (char === ' ') {
            result += ' ';
        } else if (danSmithToUnicode[char] !== undefined) {
            result += String.fromCodePoint(danSmithToUnicode[char]);
        } else {
            // Keep unmapped characters as-is (numbers, etc.)
            result += char;
        }
    }
    return result;
}

// Test with sample text
const classical = require('tengwar/classical');
const font = require('tengwar/tengwar-annatar');

const lines = [
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
    ["Nai elye hiruva Namarie", "Maybe even thou shalt find it. Farewell!"]
];

console.log("Namárië transcription in Unicode PUA encoding:\n");
const options = classical.makeOptions({ font, plain: true });

const results = [];
for (const [quenya, english] of lines) {
    const danSmith = classical.transcribe(quenya, options);
    const unicode = convertToUnicode(danSmith);
    results.push({ quenya, english, danSmith, unicode });
    console.log(`English: ${english}`);
    console.log(`Unicode: ${unicode}`);
    console.log('');
}

// Output for use in HTML
console.log("\n=== HTML snippets for design.md ===\n");
for (const { english, unicode } of results) {
    console.log(`<em><span class="elvish" data-content="${english}">${unicode}</span></em>`);
    console.log('');
}
