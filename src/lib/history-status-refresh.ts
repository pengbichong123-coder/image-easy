type RefreshableHistoryItem = {
  id: string;
  status: string;
};

type HistoryItemStatusRefresh<T extends RefreshableHistoryItem> = Partial<T> & {
  id: string;
};

const REFRESHABLE_STATUSES = new Set(["pending", "processing"]);

export function getHistoryItemsNeedingStatusRefresh(items: RefreshableHistoryItem[]) {
  return items
    .filter((item) => REFRESHABLE_STATUSES.has(item.status))
    .map((item) => item.id);
}

export function mergeHistoryItemStatusRefresh<T extends RefreshableHistoryItem>(
  items: T[],
  updatedItem: HistoryItemStatusRefresh<T>,
) {
  return items.map((item) => (
    item.id === updatedItem.id
      ? { ...item, ...updatedItem }
      : item
  ));
}
