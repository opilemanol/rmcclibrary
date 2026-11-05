import { jsPDF } from "jspdf";

function printable(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(printable).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return Object.entries(object).map(([key, item]) => `${key}: ${printable(item)}`).filter((line) => !line.endsWith(": ")).join("\n");
  }
  return "";
}

async function fontAsBase64(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new Error("The offline PDF font is unavailable.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

export async function createDocumentPdf(title: string, libraryName: string, record: Record<string, unknown>): Promise<Blob> {
  const pdf = new jsPDF({ format: "a4", unit: "mm" });
  const [regularFont, boldFont] = await Promise.all([
    fontAsBase64("./fonts/DejaVuSans.ttf"),
    fontAsBase64("./fonts/DejaVuSans-Bold.ttf"),
  ]);
  pdf.addFileToVFS("DejaVuSans.ttf", regularFont);
  pdf.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
  pdf.addFileToVFS("DejaVuSans-Bold.ttf", boldFont);
  pdf.addFont("DejaVuSans-Bold.ttf", "DejaVuSans", "bold");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const left = 18;
  const right = 18;
  let y = 24;

  pdf.setTextColor(10, 10, 10);
  pdf.setFont("DejaVuSans", "bold");
  pdf.setFontSize(18);
  pdf.text("RMCC Intl", left, y);
  y += 10;
  pdf.setFontSize(14);
  pdf.text(title, left, y);
  y += 7;
  pdf.setFont("DejaVuSans", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(74, 118, 242);
  pdf.text(libraryName, left, y);
  y += 10;
  pdf.setDrawColor(255, 215, 0);
  pdf.line(left, y, pageWidth - right, y);
  y += 8;

  const addText = (heading: string, value: string) => {
    if (!value.trim()) return;
    pdf.setFont("DejaVuSans", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(10, 10, 10);
    const headingLines = pdf.splitTextToSize(heading, pageWidth - left - right);
    if (y + headingLines.length * 5 + 6 > pageHeight - 22) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(headingLines, left, y);
    y += headingLines.length * 5 + 2;
    pdf.setFont("DejaVuSans", "normal");
    pdf.setFontSize(10);
    const lines = pdf.splitTextToSize(value, pageWidth - left - right);
    for (const line of lines) {
      if (y > pageHeight - 20) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(line, left, y);
      y += 5;
    }
    y += 4;
  };

  for (const [key, value] of Object.entries(record)) {
    if (["id", "title", "day", "week", "moduleNumber"].includes(key)) continue;
    if (typeof value === "string" && value.startsWith("data:image/")) {
      if (y + 27 > pageHeight - 22) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFont("DejaVuSans", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(10, 10, 10);
      pdf.text(key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()), left, y);
      y += 3;
      pdf.addImage(value, "PNG", left, y, 65, 20);
      y += 25;
      continue;
    }
    const text = printable(value);
    if (text) addText(key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()), text);
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`RMCC Church Library  •  ${page} / ${pages}`, left, pageHeight - 10);
  }
  return pdf.output("blob");
}
