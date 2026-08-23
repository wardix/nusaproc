export interface PrItemInput {
  itemName?: string;
  quantityRequested?: number | null;
  uom?: string;
  estimatedUnitPrice?: number | null;
  [key: string]: unknown;
}

export function calculatePrGrandTotal(items?: PrItemInput[] | null): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const qty = Number(item?.quantityRequested) || 0;
    const price = Number(item?.estimatedUnitPrice) || 0;
    return sum + Math.max(0, qty) * Math.max(0, price);
  }, 0);
}
