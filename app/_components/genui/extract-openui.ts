export type OpenUiBlock = {
  readonly source: string;
  readonly closed: boolean;
};

/** Returns the single OpenUI block allowed by the analysis response contract. */
export function extractOpenUiBlock(text: string): OpenUiBlock | null {
  const opening = /^```openui\s*\n?/imu.exec(text);
  if (!opening || opening.index === undefined) return null;

  const start = opening.index + opening[0].length;
  const closingOffset = text.indexOf("```", start);
  if (closingOffset === -1) return { source: text.slice(start), closed: false };

  return { source: text.slice(start, closingOffset), closed: true };
}

export function hasOnlyOneOpenUiBlock(text: string) {
  return (text.match(/^```openui\s*$/gimu) ?? []).length === 1;
}
