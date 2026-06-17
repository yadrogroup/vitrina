export function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

export function dot(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

export function rankEmbeddings(
  query: number[],
  items: Record<string, number[]>,
  topK: number,
): { id: string; score: number }[] {
  return Object.entries(items)
    .map(([id, vector]) => ({ id, score: dot(query, vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
