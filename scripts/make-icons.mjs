// Genera los iconos de la PWA y de la app Android a partir de un SVG (un plato visto desde arriba).
// Uso: node scripts/make-icons.mjs   (los PNG resultantes se guardan en public/icons y se versionan)
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const TOMATO = "#e8452c";

/** El plato: anillo exterior, centro y cubiertos. `scale` reduce el dibujo para dejar margen (iconos maskable). */
function svg({ rounded, scale, background = true }) {
  const radius = rounded ? 112 : 0;
  const base = background ? `<rect width="512" height="512" rx="${radius}" fill="${TOMATO}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${base}
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)" fill="none" stroke="#fff" stroke-linecap="round">
    <circle cx="256" cy="256" r="118" stroke-width="26"/>
    <circle cx="256" cy="256" r="58" fill="#fff" stroke="none"/>
    <path d="M96 170v62a22 22 0 0 0 22 22v92M96 170v50M118 170v50M140 170v50" stroke-width="20" stroke-linejoin="round"/>
    <path d="M416 170c-26 18-34 56-30 92h30v84M416 170v176" stroke-width="20" stroke-linejoin="round"/>
  </g>
</svg>`;
}

const outputs = [
  { file: "icon-192.png", size: 192, rounded: true, scale: 1 },
  { file: "icon-512.png", size: 512, rounded: true, scale: 1 },
  // Maskable: el sistema recorta la forma, así que va a sangre y con el dibujo en la zona segura.
  { file: "icon-maskable-512.png", size: 512, rounded: false, scale: 0.72 },
  { file: "apple-touch-icon.png", size: 180, rounded: false, scale: 0.86 },
];

await mkdir("public/icons", { recursive: true });
for (const { file, size, rounded, scale } of outputs) {
  const png = await sharp(Buffer.from(svg({ rounded, scale }))).resize(size, size).png().toBuffer();
  await writeFile(`public/icons/${file}`, png);
  console.log("✓", file);
}
// Mismo dibujo como SVG, para pestañas del navegador.
await writeFile("public/icons/icon.svg", svg({ rounded: true, scale: 1 }));
console.log("✓ icon.svg");

// Iconos del lanzador de Android: cuadrado, redondo y la capa frontal del icono adaptable
// (el fondo adaptable es el color de ic_launcher_background.xml).
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [density, factor] of Object.entries(DENSITIES)) {
  const dir = `android/app/src/main/res/mipmap-${density}`;
  await mkdir(dir, { recursive: true });

  const legacy = Math.round(48 * factor);
  const square = await sharp(Buffer.from(svg({ rounded: true, scale: 1 }))).resize(legacy, legacy).png().toBuffer();
  await writeFile(`${dir}/ic_launcher.png`, square);

  const circle = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`,
  );
  const round = await sharp(Buffer.from(svg({ rounded: false, scale: 0.9 })))
    .resize(legacy, legacy)
    .composite([{ input: circle, blend: "dest-in" }])
    .png()
    .toBuffer();
  await writeFile(`${dir}/ic_launcher_round.png`, round);

  const layer = Math.round(108 * factor);
  const foreground = await sharp(Buffer.from(svg({ rounded: false, scale: 0.62, background: false })))
    .resize(layer, layer)
    .png()
    .toBuffer();
  await writeFile(`${dir}/ic_launcher_foreground.png`, foreground);
}
console.log("✓ iconos de Android");
