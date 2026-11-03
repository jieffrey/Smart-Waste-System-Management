// Turns user search text into a safe ILIKE pattern: "50%_off" -> "%50\%\_off%".
// Returns null when there is no search text, so SQL can use `($n::text IS NULL OR column ILIKE $n)`.
function likePattern(text) {
  if (!text) {
    return null;
  }
  const escaped = text.replace(/[\\%_]/g, (character) => `\\${character}`);
  return `%${escaped}%`;
}

module.exports = { likePattern };
