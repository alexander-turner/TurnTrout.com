// Generate Namárië transcription in Unicode PUA for Tengwar Artano
const classical = require('tengwar/classical');
const font = require('tengwar/tengwar-annatar');
const fs = require('fs');

const danSmithToUnicode = {
    '1': 0xE000, 'q': 0xE001, 'a': 0xE002, 'z': 0xE003,
    '2': 0xE004, 'w': 0xE005, 's': 0xE006, 'x': 0xE007,
    '3': 0xE008, 'e': 0xE009, 'd': 0xE00A, 'c': 0xE00B,
    '4': 0xE00C, 'r': 0xE00D, 'f': 0xE00E, 'v': 0xE00F,
    '5': 0xE010, 't': 0xE011, 'g': 0xE012, 'b': 0xE013,
    '6': 0xE014, 'y': 0xE015, 'h': 0xE016, 'n': 0xE017,
    '7': 0xE018, 'u': 0xE019, 'j': 0xE01A, 'm': 0xE01B,
    '8': 0xE01C, 'i': 0xE01D, 'k': 0xE01E, ',': 0xE01F,
    '9': 0xE020, 'o': 0xE021, 'l': 0xE022, '.': 0xE023,
    '`': 0xE025, '~': 0xE026,
    '=': 0xE050, '-': 0xE051, 'Á': 0xE052,
    '#': 0xE040, 'E': 0xE040, 'D': 0xE040, 'C': 0xE040,
    '$': 0xE041, 'R': 0xE041, 'F': 0xE041, 'V': 0xE041,
    '%': 0xE042, 'T': 0xE042, 'G': 0xE042, 'B': 0xE042,
    '^': 0xE043, 'Y': 0xE043, 'H': 0xE043, 'N': 0xE043,
    '&': 0xE044, 'U': 0xE044, 'J': 0xE044, 'M': 0xE044,
};

function convertToUnicode(text) {
    let result = '';
    for (const c of text) {
        if (c === ' ') result += ' ';
        else if (danSmithToUnicode[c] !== undefined) result += String.fromCodePoint(danSmithToUnicode[c]);
        else result += c;
    }
    return result;
}

// Namárië lines - Quenya text and English translation
const lines = [
    ['Ai laurie lantar lassi surinen', 'Ah! like gold fall the leaves in the wind,'],
    ['yeni unotime ve ramar aldaron', 'long years numberless as the wings of trees!'],
    ['yeni ve linte yuldar avanier', 'The years have passed like swift draughts'],
    ['mi oromardi lisse miruvóreva', 'of the sweet mead in lofty halls beyond the West,'],
    ['Andune pella Vardo tellumar nu luini', 'beneath the blue vaults of Varda'],
    ['yassen tintilar i eleni', 'wherein the stars tremble'],
    ['omaryo airetari lirinen', 'in the song of her voice, holy and queenly.'],
    ['Si man i yulma nin enquantuva', 'Who now shall refill the cup for me?'],
    ['An si Tintalle Varda Oiolosseo', 'For now the Kindler, Varda, the Queen of the Stars,'],
    ['ve fanyar maryat Elentari ortane', 'from Mount Everwhite has uplifted her hands like clouds,'],
    ['ar ilye tier undulave lumbule', 'and all paths are drowned deep in shadow;'],
    ['ar sindanoriello caita mornie', 'and out of a grey country darkness lies'],
    ['i falmalinnar imbe met', 'on the foaming waves between us,'],
    ['ar hisie untupa Calaciryo miri oiale', 'and mist covers the jewels of Calacirya for ever.'],
    ['Si vanwa na Romello vanwa Valimar', 'Now lost, lost to those from the East is Valimar!'],
    ['Namarie nai hiruvalye Valimar', 'Farewell! Maybe thou shalt find Valimar.'],
    ['Nai elye hiruva Namarie', 'Maybe even thou shalt find it. Farewell!']
];

const options = classical.makeOptions({ font, plain: true });

const results = [];
for (const [quenya, english] of lines) {
    const danSmith = classical.transcribe(quenya, options);
    const unicode = convertToUnicode(danSmith);
    results.push({ quenya, english, tengwar: unicode });
}

// Output as JSON for use in updating design.md
const output = JSON.stringify(results, null, 2);
fs.writeFileSync('scripts/namarie_data.json', output);
console.log('Saved to scripts/namarie_data.json');

// Also output the markdown snippets
console.log('\n=== Markdown for design.md ===\n');
for (const { tengwar, english } of results) {
    console.log(`<span class="elvish"><span class="elvish-tengwar">${tengwar}</span><span class="elvish-translation">${english}</span></span>`);
    console.log('');
}
