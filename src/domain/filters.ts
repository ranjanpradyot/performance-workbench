export interface Filters {
  year: string;
  quarterId: string;
  reporteeId: string;
  category: string;
  status: string;
  directory: "active" | "archived" | "all";
}

export const defaultFilters: Filters = {
  year: "all",
  quarterId: "all",
  reporteeId: "all",
  category: "all",
  status: "all",
  directory: "active",
};
