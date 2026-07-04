export function getEditDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1  // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function fuzzyMatch(text: string | undefined | null, query: string): { matches: boolean; score: number } {
  const normalizedText = (text || "").toLowerCase().trim();
  const normalizedQuery = (query || "").toLowerCase().trim();

  if (!normalizedQuery) return { matches: true, score: 1 };

  // 1. Direct substring match (highest priority / perfect match)
  if (normalizedText.includes(normalizedQuery)) {
    // Score based on position of substring (earlier matches are higher score)
    const index = normalizedText.indexOf(normalizedQuery);
    const score = 1 - (index / normalizedText.length) * 0.1;
    return { matches: true, score };
  }

  // 2. Token-based matching (for typing words in different order)
  const queryTokens = normalizedQuery.split(/\s+/);
  const textTokens = normalizedText.split(/\s+/);

  let matchedTokens = 0;
  let totalDistance = 0;

  for (const qToken of queryTokens) {
    let bestTokenMatchScore = 0;
    for (const tToken of textTokens) {
      if (tToken === qToken) {
        bestTokenMatchScore = 1.0;
        break;
      }
      if (tToken.includes(qToken)) {
        bestTokenMatchScore = Math.max(bestTokenMatchScore, qToken.length / tToken.length);
      }

      const distance = getEditDistance(qToken, tToken);
      const maxLength = Math.max(qToken.length, tToken.length);
      const similarity = 1 - distance / maxLength;

      const maxAllowedDifference = qToken.length <= 4 ? 1 : 2;
      if (distance <= maxAllowedDifference) {
        bestTokenMatchScore = Math.max(bestTokenMatchScore, similarity);
      }
    }

    if (bestTokenMatchScore > 0.4) {
      matchedTokens++;
      totalDistance += (1 - bestTokenMatchScore);
    }
  }

  if (matchedTokens === queryTokens.length) {
    const avgDistance = queryTokens.length > 0 ? totalDistance / queryTokens.length : 0;
    return { matches: true, score: 0.8 - avgDistance * 0.3 };
  }

  return { matches: false, score: 0 };
}
