import { ChartData, ChartType } from "./types";

export const transformDataForChart = (
  data: Record<string, unknown>[]
): ChartData[] => {
  if (!data || data.length === 0) return [];

  const firstItem = data[0];
  const keys = Object.keys(firstItem);

  // Find the best key for names/labels (prefer text fields)
  const nameKey =
    keys.find(
      (key) =>
        typeof firstItem[key] === "string" &&
        (key.toLowerCase().includes("name") ||
          key.toLowerCase().includes("title") ||
          key.toLowerCase().includes("label") ||
          key.toLowerCase().includes("category"))
    ) ||
    keys.find((key) => typeof firstItem[key] === "string") ||
    keys[0];

  // Find the best key for values (prefer numeric fields)
  const valueKey =
    keys.find(
      (key) =>
        typeof firstItem[key] === "number" &&
        (key.toLowerCase().includes("count") ||
          key.toLowerCase().includes("total") ||
          key.toLowerCase().includes("amount") ||
          key.toLowerCase().includes("value") ||
          key.toLowerCase().includes("price"))
    ) || keys.find((key) => typeof firstItem[key] === "number");

  if (!valueKey) return [];

  return data.map((item, index) => ({
    name: String(item[nameKey] || `Item ${index + 1}`),
    value: Number(item[valueKey]) || 0,
    ...item,
  }));
};

export const isSimpleTable = (
  data: unknown
): data is Record<string, unknown>[] => {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    typeof data[0] === "object" &&
    !Array.isArray(data[0])
  );
};
