const fs = require('fs');

// Read the Namárië data
const data = JSON.parse(fs.readFileSync('scripts/namarie_data.json', 'utf8'));

// Generate the new Namárië section
const breaksBefore = [7, 8, 10, 14, 15, 16]; // Line indices that need <br> before them

let namarieLine = [];
for (let i = 0; i < data.length; i++) {
    const { tengwar, english } = data[i];

    if (breaksBefore.includes(i)) {
        namarieLine.push('> <br>');
    }

    namarieLine.push(`> <span class="elvish"><span class="elvish-tengwar">${tengwar}</span><span class="elvish-translation">${english}</span></span>`);
    namarieLine.push('>');
}

const newNamarieContent = namarieLine.join('\n');

// Read design.md
const designPath = 'website_content/design.md';
let content = fs.readFileSync(designPath, 'utf8');

// Update the font description
content = content.replace(
    'My site contains a range of fun fonts which I rarely use. For example, the _Lord of the Rings_ font "Tengwar Annatar" renders Elvish glyphs.',
    'My site contains a range of fun fonts which I rarely use. For example, the _Lord of the Rings_ font "Tengwar Artano" renders Elvish glyphs in proper Quenya mode.'
);

// Replace the Namárië section
// Find the quote block and replace its content
const oldQuoteStart = '> [!quote]- [_Namárië_: Galadriel\'s Lament in Lórien](https://www.youtube.com/watch?v=re5_lzlFS9M)\n>\n> Subtitle: Hover over a line to translate';
const newQuoteStart = '> [!quote]- [_Namárië_: Galadriel\'s Lament in Lórien](https://www.youtube.com/watch?v=re5_lzlFS9M)\n>\n> Subtitle: Click a line to see the translation';

content = content.replace(oldQuoteStart, newQuoteStart);

// The old content pattern - from first elvish span to the last one before spellchecker-enable
const oldContentPattern = /> <em><span class="elvish" data-content="Ah! like gold.*?> <em><span class="elvish" data-content="Maybe even thou shalt find it. Farewell!">.*?<\/span><\/em>/s;

// Replace the old elvish content with the new content
const audioLine = '> <div class="centered"><audio src="https://assets.turntrout.com/static/audio/namarie.mp3" controls/></div>';
const insertionPoint = content.indexOf(audioLine);
if (insertionPoint === -1) {
    console.error('Could not find audio line insertion point');
    process.exit(1);
}

// Find the end of the old content (just before spellchecker-enable)
const spellcheckerEnd = '<!-- spellchecker-enable -->';
const spellcheckerIndex = content.indexOf(spellcheckerEnd, insertionPoint);
if (spellcheckerIndex === -1) {
    console.error('Could not find spellchecker-enable');
    process.exit(1);
}

// Find the position after the audio line
const afterAudioLine = content.indexOf('\n', insertionPoint + audioLine.length) + 1;

// Get the content between audio line and spellchecker-enable
const oldElvishSection = content.substring(afterAudioLine, spellcheckerIndex);

// Replace with new content
content = content.substring(0, afterAudioLine) +
          '>\n' + newNamarieContent + '\n\n' +
          content.substring(spellcheckerIndex);

// Write back
fs.writeFileSync(designPath, content);
console.log('Updated design.md successfully');

// Print the new section for verification
console.log('\n=== New Namárië section ===');
console.log(newNamarieContent.substring(0, 500) + '...');
