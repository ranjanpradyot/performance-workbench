import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { mergeDatasets } from "../src/infrastructure/excel/dataset";
import { importWorkbook } from "../src/infrastructure/excel/import-workbook";

const files = [
  path.resolve("fixtures/workbooks/Utkarsh_OKR_Checklist_Linked_0.4.xlsx"),
  path.resolve("fixtures/workbooks/Krishna_OKR_Checklist_Linked_0.4.xlsx"),
  path.resolve("fixtures/workbooks/Santosh_OKR_Checklist_Linked_0.4.xlsx"),
];

const parts = [];
async function main() {
for (const [index, file] of files.entries()) {
  const buffer = await readFile(file);
  const result = await importWorkbook(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), path.basename(file), index);
  console.log(path.basename(file), result.dataset.tickets.length, "tickets", result.warnings.length, "warnings");
  result.warnings.slice(0, 8).forEach((warning) => console.log(" ", warning));
  parts.push(result.dataset);
}

const dataset = mergeDatasets(parts);
const target = path.resolve("public/seed/initial-dataset.json");
let previousRevision = 0;
try {
  const existing = JSON.parse(await readFile(target, "utf8")) as { application?: { revision?: number } };
  previousRevision = existing.application?.revision ?? 0;
} catch {
  previousRevision = 0;
}
dataset.application.revision = Math.max(dataset.application.revision, previousRevision) + 1;
dataset.application.updatedAt = new Date().toISOString();
await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(dataset));
console.log("wrote", target, "reportees", dataset.reportees.length, "tickets", dataset.tickets.length, "revision", dataset.application.revision);
}

main();
