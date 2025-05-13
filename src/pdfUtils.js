import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'; // 👈 Vite-compatible

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function extractTextFromPDF(file) {
  try {
    const typedArray = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `Page ${i}:\n${pageText}\n\n`;
    }

    return fullText.trim();
  } catch (error) {
    console.error('[extractTextFromPDF] ❌ Erreur lors de l\'extraction PDF :', error);
    return '';
  }
}
