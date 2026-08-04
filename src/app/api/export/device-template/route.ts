import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/export/device-template → downloads the blank bulk-import template,
// matching the shared Inventory Register columns, with an example row.
const HEADERS = [
  "S.No",
  "Date",
  "Device ID",
  "Device Name",
  "Model No",
  "Serial No / IMEI",
  "Qty Purchased",
  "Vendor Name",
  "Invoice No",
  "Purchase Cost",
  "Assigned To",
  "Project / Client",
  "Location",
  "Status",
  "Installed Status",
  "Installed by",
  "Remarks",
];

const EXAMPLE = [
  "1",
  "26/08/2025",
  "ROQIT-GPS-001",
  "Sinocastle dash cam",
  "A-267 AI Dash cam",
  "18270980387",
  "2",
  "Sinocastle",
  "SCQT250826",
  "18270",
  "Ohm cabs",
  "Ohm cabs",
  "Hyderabad",
  "ETO custody",
  "Yes",
  "Prashanth",
  "",
];

export async function GET(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "ROQIT Billing";
  wb.created = new Date();
  const ws = wb.addWorksheet("Inventory Register");

  ws.addRow(HEADERS);
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle" };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  });

  const ex = ws.addRow(EXAMPLE);
  ex.font = { italic: true, color: { argb: "FF94A3B8" } };

  ws.columns.forEach((col, i) => {
    const h = HEADERS[i] || "";
    col.width = Math.max(h.length + 2, 12);
  });
  ws.getColumn(10).numFmt = "#,##0.00"; // Purchase Cost
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // A short instructions sheet so newcomers know how the import behaves.
  const help = wb.addWorksheet("How to use");
  help.getColumn(1).width = 100;
  [
    "ROQIT Billing — Device bulk import template",
    "",
    "1. Fill one row per device under the headers on the 'Inventory Register' sheet.",
    "2. Delete the grey example row before uploading (or leave it — it will import too).",
    "3. Keep the header names as-is. Extra columns are ignored; column order doesn't matter.",
    "4. Date format: dd/mm/yyyy.",
    "5. 'Serial No / IMEI' is stored as the device IMEI (values may repeat across rows).",
    "6. 'Installed Status' = Yes/Installed/Custody marks the device as Deployed; otherwise In stock.",
    "7. 'Vendor Name' links to a matching Supplier if one exists (create suppliers first to link them).",
    "8. 'Device ID' is used to skip rows already imported, so re-uploading the same file is safe.",
    "9. Model No, Invoice No, Qty, Project/Client, Installed by, Status and Remarks are saved to the device's Notes.",
  ].forEach((line) => help.addRow([line]));
  help.getRow(1).font = { bold: true, size: 13 };

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="roqit-device-import-template.xlsx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
