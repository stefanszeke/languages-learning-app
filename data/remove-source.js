const fs = require("fs");

const inputFile = "german-sentences.js";
const backupFile = "b.js";

let content = fs.readFileSync(inputFile, "utf8");

// Make a backup before modifying anything.
fs.copyFileSync(inputFile, backupFile);

/*
 * Removes properties shaped like:
 *
 * ,"source": {
 *   ...
 * }
 *
 * This version supports nested objects and braces inside strings.
 */
function removeSourceProperties(text) {
  const sourcePattern = /,\s*["']source["']\s*:\s*\{/g;

  let result = "";
  let lastCopiedIndex = 0;
  let match;

  while ((match = sourcePattern.exec(text)) !== null) {
    const objectStart = sourcePattern.lastIndex - 1;

    let depth = 0;
    let quote = null;
    let escaped = false;
    let objectEnd = -1;

    for (let i = objectStart; i < text.length; i++) {
      const char = text[i];

      if (quote !== null) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === quote) {
          quote = null;
        }

        continue;
      }

      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        continue;
      }

      if (char === "{") {
        depth++;
      } else if (char === "}") {
        depth--;

        if (depth === 0) {
          objectEnd = i + 1;
          break;
        }
      }
    }

    if (objectEnd === -1) {
      throw new Error(
        `Could not find the end of a source object near position ${match.index}.`
      );
    }

    result += text.slice(lastCopiedIndex, match.index);
    lastCopiedIndex = objectEnd;

    sourcePattern.lastIndex = objectEnd;
  }

  result += text.slice(lastCopiedIndex);
  return result;
}

const updatedContent = removeSourceProperties(content);

const originalSize = content.length;
const updatedSize = updatedContent.length;

if (originalSize === updatedSize) {
  console.log('No "source" properties were found.');
} else {
  fs.writeFileSync(inputFile, updatedContent, "utf8");

  console.log(`Updated: ${inputFile}`);
  console.log(`Backup:  ${backupFile}`);
  console.log(`Removed ${originalSize - updatedSize} characters.`);
}