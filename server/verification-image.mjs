import sharp from 'sharp';

const MASCOT_URL =
  'https://media.labrica.pro/email/mascot-verification.png';

let mascotCache = null;

async function getMascot() {
  if (mascotCache) return mascotCache;

  const response = await fetch(MASCOT_URL);

  if (!response.ok) {
    throw new Error(`Не удалось загрузить маскота: ${response.status}`);
  }

  mascotCache = Buffer.from(await response.arrayBuffer());
  return mascotCache;
}

export async function createVerificationImage(code) {
  const cleanCode = String(code).replace(/\D/g, '');

  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error('Код должен состоять из 6 цифр');
  }

  const prettyCode = `${cleanCode.slice(0, 3)} ${cleanCode.slice(3)}`;

  const mascot = await getMascot();

  // Размер исходной картинки: примерно 1147 × 1371.
  // SVG имеет тот же размер и кладётся поверх PNG.
  const overlay = Buffer.from(`
    <svg
      width="1147"
      height="1371"
      viewBox="0 0 1147 1371"
      xmlns="http://www.w3.org/2000/svg"
    >
            <text
        x="573.5"
        y="770"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="Arial Rounded MT Bold, Arial, sans-serif"
        font-size="108"
        font-weight="900"
        letter-spacing="7"
        fill="#17352d"
      >${prettyCode}</text>
    </svg>
  `);

  return sharp(mascot)
    .composite([
      {
        input: overlay,
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
}
