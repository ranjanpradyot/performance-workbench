import { readFile } from "node:fs/promises";
import path from "node:path";
import { isSourceWorkbook } from "@/infrastructure/excel/source-workbooks";

export async function GET(request: Request): Promise<Response> {
  const file = new URL(request.url).searchParams.get("file") ?? "";
  if (!isSourceWorkbook(file)) return new Response("Not found", { status: 404 });
  const bytes = await readFile(path.join(process.cwd(), "fixtures", "workbooks", file));
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    },
  });
}
