const fs = require('fs');
const pdf = require('pdf-parse');

async function parse() {
    let dataBuffer = fs.readFileSync('mock_cutoff.pdf');
    try {
        const data = await pdf(dataBuffer);
        const text = data.text;
        const lines = text.split('\n');
        // print lines 20 to 60
        console.log(lines.slice(20, 60).join('\n'));
    } catch(err) {
        console.error(err);
    }
}
parse();
