import { readdir, mkdir, readFile, writeFile } from "node:fs/promises";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

globalThis.DOMMatrix ??= DOMMatrix;
globalThis.ImageData ??= ImageData;
globalThis.Path2D ??= Path2D;

const clientDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = resolve(
  clientDirectory,
  "../calvin-map/Building & Campus Plans/Academic & Auxiliary Buildings",
);
const [onlyFile, outputArgument] = process.argv.slice(2);
const checkOnly = onlyFile === "--check";
const outputDirectory = outputArgument
  ? resolve(outputArgument)
  : resolve(clientDirectory, "assets/floorplans/academic-auxiliary");
const scale = Number(process.env.FLOORPLAN_SCALE ?? 2);
// Ignore the standard title strip and detect map artwork above it.
const FOOTER_START = 0.875;
const CONTENT_THRESHOLD = 248;

function findMapBounds(context, width, height) {
  const pixels = context.getImageData(0, 0, width, height).data;
  const pageMargin = Math.round(Math.min(width, height) * 0.025);
  const padding = Math.round(Math.min(width, height) * 0.02);
  const footerStart = Math.floor(height * FOOTER_START);
  let left = width;
  let top = footerStart;
  let right = 0;
  let bottom = pageMargin;

  for (let y = pageMargin; y < footerStart; y++) {
    for (let x = pageMargin; x < width - pageMargin; x++) {
      const index = (y * width + x) * 4;
      if (Math.min(pixels[index], pixels[index + 1], pixels[index + 2]) < CONTENT_THRESHOLD) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (right < left || bottom < top) {
    throw new Error("Could not find map artwork above the title strip");
  }

  const cropLeft = Math.max(0, left - padding);
  const cropTop = Math.max(0, top - padding);
  const cropRight = Math.min(width, right + padding + 1);
  const cropBottom = Math.min(footerStart, bottom + padding + 1);

  return {
    left: cropLeft,
    top: cropTop,
    width: cropRight - cropLeft,
    height: cropBottom - cropTop,
  };
}

// Source filenames encode both the building name and the floor label.
function getPlanDetails(fileName) {
  const levelMatch = fileName.match(/^(.*)\s+level\s+(.+)\.pdf$/i);
  if (levelMatch) {
    return { building: levelMatch[1], floor: `Level ${levelMatch[2]}` };
  }

  const specialFloorMatch = fileName.match(
    /^(.*)\s+(sub-basement|storage loft|overall map)\.pdf$/i,
  );
  if (specialFloorMatch) {
    return {
      building: specialFloorMatch[1],
      floor: specialFloorMatch[2].replace(/\b\w/g, (letter) =>
        letter.toUpperCase(),
      ),
    };
  }

  return { building: fileName.replace(/\.pdf$/i, ""), floor: "Main Floor" };
}

const sourceFiles = (await readdir(sourceDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
  .map((entry) => entry.name)
  .filter((name) => checkOnly || !onlyFile || name === onlyFile)
  .sort((first, second) => first.localeCompare(second));

if (sourceFiles.length === 0) {
  throw new Error(onlyFile ? `No PDF found matching ${onlyFile}` : "No PDF plans found");
}

await mkdir(outputDirectory, { recursive: true });
const renderedPlans = [];

for (const sourceFile of sourceFiles) {
  const data = new Uint8Array(await readFile(join(sourceDirectory, sourceFile)));
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
  const pdf = await loadingTask.promise;
  if (checkOnly) {
    console.log(`${sourceFile}: ${pdf.numPages} page(s)`);
    await loadingTask.destroy();
    continue;
  }

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: context, viewport, canvas }).promise;

  const mapBounds = findMapBounds(context, canvas.width, canvas.height);
  const mapCanvas = createCanvas(mapBounds.width, mapBounds.height);
  const mapContext = mapCanvas.getContext("2d");
  mapContext.fillStyle = "#FFFFFF";
  mapContext.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
  mapContext.drawImage(
    canvas,
    mapBounds.left,
    mapBounds.top,
    mapBounds.width,
    mapBounds.height,
    0,
    0,
    mapBounds.width,
    mapBounds.height,
  );

  const outputFile = `${parse(sourceFile).name}.png`;
  const outputPath = join(outputDirectory, outputFile);
  await writeFile(outputPath, mapCanvas.toBuffer("image/png"));
  renderedPlans.push({
    ...getPlanDetails(sourceFile),
    fileName: outputFile,
    width: mapCanvas.width,
    height: mapCanvas.height,
  });
  console.log(
    `${sourceFile}: ${canvas.width}x${canvas.height} sheet -> ${mapCanvas.width}x${mapCanvas.height} map, ${outputPath}`,
  );

  await loadingTask.destroy();
}

if (!checkOnly && !onlyFile && !outputArgument) {
  // Metro needs literal require calls to include each generated PNG in the app bundle.
  const plans = renderedPlans
    .map(
      ({ building, floor, fileName, width, height }) => `  {
    building: ${JSON.stringify(building)},
    label: ${JSON.stringify(floor)},
    width: ${width},
    height: ${height},
    asset: require(${JSON.stringify(`../../assets/floorplans/academic-auxiliary/${fileName}`)}) as number,
  },`,
    )
    .join("\n");
  const manifest = resolve(clientDirectory, "src/data/floorplan-manifest.ts");
  await writeFile(manifest, `export const FLOOR_PLANS = [\n${plans}\n] as const;\n`);
  console.log(`Wrote ${renderedPlans.length} plans to ${manifest}`);
}