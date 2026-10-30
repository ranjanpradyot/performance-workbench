/** Original linked checklists. Export serves these bytes so the workbook layout is unchanged. */
export const SOURCE_WORKBOOKS: Record<string, string> = {
  Utkarsh: "Utkarsh_OKR_Checklist_Linked_0.4.xlsx",
  Krishna: "Krishna_OKR_Checklist_Linked_0.4.xlsx",
  Santosh: "Santosh_OKR_Checklist_Linked_0.4.xlsx",
};

export function sourceWorkbookFor(fullName: string): string | undefined {
  return SOURCE_WORKBOOKS[fullName];
}

export function isSourceWorkbook(file: string): file is (typeof SOURCE_WORKBOOKS)[keyof typeof SOURCE_WORKBOOKS] {
  return Object.values(SOURCE_WORKBOOKS).includes(file);
}
