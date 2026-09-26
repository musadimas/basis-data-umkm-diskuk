export function rows(result) {
  return result?.rows ?? result ?? [];
}

export function stall(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clip(value, max) {
  if (value === undefined || value === null) return null;
  const text = String(value);
  return text.length > max ? text.slice(0, max) : text;
}
