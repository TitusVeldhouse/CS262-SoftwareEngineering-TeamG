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

  const outputFile = `${parse(sourceFile).name}.png`;
  const outputPath = join(outputDirectory, outputFile);
  await writeFile(outputPath, canvas.toBuffer("image/png"));
  renderedPlans.push({
    ...getPlanDetails(sourceFile),
    fileName: outputFile,
    width: canvas.width,
    height: canvas.height,
  });
  console.log(
    `${sourceFile}: ${pdf.numPages} page(s), ${canvas.width}x${canvas.height}, ${outputPath}`,
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