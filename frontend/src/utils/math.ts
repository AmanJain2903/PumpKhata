/**
 * Helper to parse and evaluate sum expressions like "10 20, 30"
 * Handles spaces, commas, and pluses as separators.
 */
export const parseSumExpression = (val: string): string => {
  if (!val) return '';
  // Replace commas and pluses with spaces, then split by whitespace
  const parts = val.replace(/[,+]/g, ' ').split(/\s+/);
  let sum = 0;
  let hasValidNumber = false;
  for (const p of parts) {
    if (p.trim() === '') continue;
    const num = parseFloat(p);
    if (!isNaN(num)) {
      sum += num;
      hasValidNumber = true;
    }
  }
  return hasValidNumber ? String(sum) : val;
};
