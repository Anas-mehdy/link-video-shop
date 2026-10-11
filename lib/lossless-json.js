// Preserve unsafe JSON integer tokens before a JavaScript Number can round them.
module.exports = function losslessJSON(text) {
 return JSON.parse(text.replace(/("(?:\\.|[^"\\])*")|(?<![\w.\d+\-])(-?\d{16,})(?=\s*[,}\]])/g,(match,string,number)=>string || (Number.isSafeInteger(Number(number))?number:JSON.stringify(number))));
};
