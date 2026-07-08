export function formatEmailList(emails?: string[] | null) {
  return emails?.join(', ') ?? '';
}

export function parseEmailList(input: string) {
  return input
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
