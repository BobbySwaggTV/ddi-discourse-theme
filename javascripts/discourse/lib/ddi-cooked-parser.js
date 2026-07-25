let lastCooked = null;
let lastParsed = null;

export function parseCookedHtml(cooked) {
  const input = cooked || "";

  if (input === lastCooked) {
    return lastParsed;
  }

  lastParsed = new DOMParser().parseFromString(input, "text/html");
  lastCooked = input;

  return lastParsed;
}
