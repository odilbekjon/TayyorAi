import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

/**
 * Fayl formatlarini o'zgartirish tashqi pullik API'siz, Docker image ichidagi dasturlar bilan:
 * LibreOffice (Word/Excel/PowerPoint → PDF), pdf2docx (PDF → Word), poppler (PDF → rasm).
 */
const exec = promisify(execFile);
const TIMEOUT_MS = 120_000;

export const SOFFICE = process.env.SOFFICE_PATH || "soffice";
export const PDF2DOCX = process.env.PDF2DOCX_PATH || "pdf2docx";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "tayyorai-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function run(cmd: string, args: string[], cwd: string) {
  try {
    await exec(cmd, args, { cwd, timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 });
  } catch (err) {
    const e = err as { code?: string; stderr?: string; message: string };
    if (e.code === "ENOENT") throw new Error(`"${cmd}" dasturi o'rnatilmagan`);
    throw new Error(`${cmd} xatosi: ${(e.stderr || e.message).slice(0, 500)}`);
  }
}

/** LibreOffice orqali o'zgartirish. Har ish uchun alohida profil: parallel ishlar bir-birini qulflamasin */
async function soffice(input: Buffer, ext: string, target: string, extraArgs: string[] = []) {
  return withTempDir(async (dir) => {
    const src = join(dir, `input${ext}`);
    await writeFile(src, input);
    await run(
      SOFFICE,
      [`-env:UserInstallation=${pathToFileURL(join(dir, "profile")).href}`, "--headless", "--norestore", ...extraArgs, "--convert-to", target, "--outdir", join(dir, "out"), src],
      dir,
    );
    const [out] = await readdir(join(dir, "out")).catch(() => []);
    if (!out) throw new Error("LibreOffice natija fayl yaratmadi");
    return readFile(join(dir, "out", out));
  });
}

/** Word, Excel, PowerPoint (va OpenDocument) → PDF */
export function officeToPdf(input: Buffer, ext: string) {
  return soffice(input, ext, "pdf");
}

/** PDF → Word. pdf2docx jadval va formatlashni yaxshi saqlaydi, bo'lmasa LibreOffice'ga o'tamiz */
export async function pdfToDocx(input: Buffer) {
  try {
    return await withTempDir(async (dir) => {
      await writeFile(join(dir, "input.pdf"), input);
      await run(PDF2DOCX, ["convert", "input.pdf", "output.docx"], dir);
      return await readFile(join(dir, "output.docx"));
    });
  } catch (err) {
    console.warn("[convert] pdf2docx ishlamadi, LibreOffice bilan urinib ko'ramiz:", err instanceof Error ? err.message : err);
    return soffice(input, ".pdf", 'docx:"MS Word 2007 XML"', ["--infilter=writer_pdf_import"]);
  }
}

/** PDF sahifalari → JPG rasmlar (150 dpi, sahifa tartibida) */
export async function pdfToImages(input: Buffer, maxPages: number) {
  return withTempDir(async (dir) => {
    await writeFile(join(dir, "input.pdf"), input);
    await run("pdftoppm", ["-jpeg", "-jpegopt", "quality=90", "-r", "150", "-l", String(maxPages), "input.pdf", "page"], dir);
    // pdftoppm nomlari: page-01.jpg, page-02.jpg ... (raqam uzunligi sahifalar soniga bog'liq)
    const names = (await readdir(dir)).filter((n) => n.startsWith("page-")).sort((a, b) => pageNo(a) - pageNo(b));
    if (!names.length) throw new Error("PDF'dan rasm olinmadi");
    return Promise.all(names.map((n) => readFile(join(dir, n))));
  });
}

/** PDF sahifalari soni (pdfinfo) */
export async function pdfPageCount(input: Buffer) {
  return withTempDir(async (dir) => {
    await writeFile(join(dir, "input.pdf"), input);
    const { stdout } = await exec("pdfinfo", ["input.pdf"], { cwd: dir, timeout: 30_000 });
    return Number(/^Pages:\s+(\d+)/m.exec(stdout)?.[1] ?? 0);
  });
}

const pageNo = (name: string) => Number(/(\d+)\.\w+$/.exec(name)?.[1] ?? 0);

/** Rasm turini fayl boshidagi baytlardan aniqlaydi (data URL uchun) */
export function imageMime(buf: Buffer) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(0, 3).toString() === "GIF") return "image/gif";
  if (buf.subarray(0, 2).toString() === "BM") return "image/bmp";
  return null;
}
