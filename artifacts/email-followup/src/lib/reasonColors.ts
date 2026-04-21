export const PREDEFINED_REASON_COLORS = [
  "#6366F1", // Indigo
  "#EC4899", // Pink
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#3B82F6", // Blue
];

export function getPredefinedColorName(color: string): string {
  const colorMap: Record<string, string> = {
    "#6366F1": "Indigo",
    "#EC4899": "Pink",
    "#F59E0B": "Amber",
    "#10B981": "Emerald",
    "#3B82F6": "Blue",
  };
  return colorMap[color] || color;
}
