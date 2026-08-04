import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// Serves an uploaded document. Auth is enforced both by middleware and here.
// File bytes live in the database (DocumentBlob), so downloads work identically
// on a laptop and on a serverless host.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.document.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (doc.kind === "LINK") {
    if (!doc.externalUrl) return NextResponse.json({ error: "No link" }, { status: 404 });
    return NextResponse.redirect(doc.externalUrl);
  }

  const blob = await prisma.documentBlob.findUnique({ where: { documentId: doc.id } });
  if (!blob) return NextResponse.json({ error: "File missing" }, { status: 404 });

  const bytes = Buffer.from(blob.data);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.originalName || doc.title)}"`,
      "Content-Length": String(bytes.length),
    },
  });
}
