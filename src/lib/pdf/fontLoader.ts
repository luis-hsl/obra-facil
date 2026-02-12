import { jsPDF } from 'jspdf';

// ============================================================
// Google Fonts → jsPDF font loader with IndexedDB cache
// ============================================================

export type FontFamily =
  | 'helvetica' | 'times' | 'courier'
  | 'roboto' | 'opensans' | 'lato' | 'montserrat' | 'poppins'
  | 'raleway' | 'playfair' | 'merriweather' | 'nunito' | 'inter';

const BUILTIN_FONTS = new Set(['helvetica', 'times', 'courier']);

interface FontVariant {
  weight: 'normal' | 'bold';
  url: string;
  fileName: string;
}

interface FontDef {
  family: string;        // jsPDF internal name
  label: string;         // display name
  variants: FontVariant[];
}

// Google Fonts CSS2 API — fetched as text, parsed for WOFF2/TTF URLs
// We use the GitHub mirror which provides stable TTF files
const GH_BASE = 'https://raw.githubusercontent.com/google/fonts/main';

const CUSTOM_FONTS: Record<string, FontDef> = {
  roboto: {
    family: 'Roboto', label: 'Roboto',
    variants: [
      { weight: 'normal', url: `${GH_BASE}/ofl/roboto/static/Roboto-Regular.ttf`, fileName: 'Roboto-Regular.ttf' },
      { weight: 'bold',   url: `${GH_BASE}/ofl/roboto/static/Roboto-Bold.ttf`,    fileName: 'Roboto-Bold.ttf' },
    ],
  },
  opensans: {
    family: 'OpenSans', label: 'Open Sans',
    variants: [
      { weight: 'normal', url: `${GH_BASE}/ofl/opensans/static/OpenSans-Regular.ttf`, fileName: 'OpenSans-Regular.ttf' },
      { weight: 'bold',   url: `${GH_BASE}/ofl/opensans/static/OpenSans-Bold.ttf`,    fileName: 'OpenSans-Bold.ttf' },
    ],
  },
  lato: {
    family: 'Lato', label: 'Lato',
    variants: [
      { weight: 'normal', url: `${GH_BASE}/ofl/lato/Lato-Regular.ttf`, fileName: 'Lato-Regular.ttf' },
      { weight: 'bold',   url: `${GH_BASE}/ofl/lato/Lato-Bold.ttf`,    fileName: 'Lato-Bold.ttf' },
    ],
  },
  montserrat: {
    family: 'Montserrat', label: 'Montserrat',
    variants: [
      { weight: 'normal', url: `${GH_BASE}/ofl/montserrat/static/Montserrat-Regular.ttf`, fileName: 'Montserrat-Regular.ttf' },
      { weight: 'bold',   url: `${GH_BASE}/ofl/montserrat/static/Montserrat-Bold.ttf`,    fileName: 'Montserrat-Bold.ttf' },
    ],
  },
  poppins: {
    family: 'Poppins', label: 'Poppins',
    variants: [
      { weight: 'normal', url: `${GH_BASE}/ofl/poppins/Poppins-Regular.ttf`, fileName: 'Poppins-Regular.ttf' },
      { weight: 'bold',   url: `${GH_BASE}/ofl/poppins/Poppins-Bold.ttf`,    fileName: 'Poppins-Bold.ttf' },
    ],
  },
  raleway: {
    family: 'Raleway', label: 'Raleway',
    variants: [
      { weight: 'normal', url: `${GH_BASE}/ofl/raleway/static/Raleway-Regular.ttf`, fileName: 'Raleway-Regular.ttf' },
      { weight: 'bold',   url: `${GH_BASE}/ofl/raleway/static/Raleway-Bold.ttf`,    fileName: 'Raleway-Bold.ttf' },
    ],
  },
  playfair: {
    family: 'PlayfairDisplay', label: 'Playfair Display',
    variants: [
      { weight: 'normal', url: `${GH_BASE}/ofl/playfairdisplay/static/PlayfairDisplay-Regular.ttf`, fileName: 'PlayfairDisplay-Regular.ttf' },
      { weight: 'bold',   url: `${GH_BASE}/ofl/playfairdisplay/static/PlayfairDisplay-Bold.ttf`,    fileName: 'PlayfairDisplay-Bold.ttf' },
    ],
  },
  merriweather: {
    family: 'Merriweather', label: 'Merriweather',
    variants: [
      { weight: 'normal', url: `${GH_BASE}/ofl/merriweather/Merriweather-Regular.ttf`, fileName: 'Merriweather-Regular.ttf' },
      { weight: 'bold',   url: `${GH_BASE}/ofl/merriweather/Merriweather-Bold.ttf`,    fileName: 'Merriweather-Bold.ttf' },
    ],
  },
  nunito: {
    family: 'Nunito', label: 'Nunito',
    variants: [
      { weight: 'normal', url: `${GH_BASE}/ofl/nunito/static/Nunito-Regular.ttf`, fileName: 'Nunito-Regular.ttf' },
      { weight: 'bold',   url: `${GH_BASE}/ofl/nunito/static/Nunito-Bold.ttf`,    fileName: 'Nunito-Bold.ttf' },
    ],
  },
  inter: {
    family: 'Inter', label: 'Inter',
    variants: [
      { weight: 'normal', url: `${GH_BASE}/ofl/inter/static/Inter_18pt-Regular.ttf`, fileName: 'Inter-Regular.ttf' },
      { weight: 'bold',   url: `${GH_BASE}/ofl/inter/static/Inter_18pt-Bold.ttf`,    fileName: 'Inter-Bold.ttf' },
    ],
  },
};

// ── IndexedDB cache ──

const DB_NAME = 'obra-facil-fonts';
const STORE_NAME = 'font-data';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCached(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function setCache(key: string, value: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
  } catch { /* ignore */ }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ── Font loading ──

async function fetchFontAsBase64(url: string, cacheKey: string): Promise<string> {
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Font fetch failed: ${resp.status}`);
  const buf = await resp.arrayBuffer();
  const b64 = arrayBufferToBase64(buf);

  await setCache(cacheKey, b64);
  return b64;
}

/**
 * Loads a custom font into a jsPDF document.
 * Built-in fonts (helvetica, times, courier) are skipped.
 * Returns the jsPDF font family name to use with doc.setFont().
 */
export async function loadFont(doc: jsPDF, fontKey: FontFamily): Promise<string> {
  if (BUILTIN_FONTS.has(fontKey)) return fontKey;

  const def = CUSTOM_FONTS[fontKey];
  if (!def) return 'helvetica'; // fallback

  for (const variant of def.variants) {
    try {
      const b64 = await fetchFontAsBase64(variant.url, variant.fileName);
      doc.addFileToVFS(variant.fileName, b64);
      doc.addFont(variant.fileName, def.family, variant.weight);
    } catch {
      // If font download fails, we'll fallback to helvetica
      console.warn(`Failed to load font ${variant.fileName}, falling back to helvetica`);
      return 'helvetica';
    }
  }

  return def.family;
}

/** All font options for the UI select */
export const FONT_OPTIONS: { value: FontFamily; label: string; category: string; cssFamily: string }[] = [
  { value: 'helvetica', label: 'Helvetica', category: 'Clássicas', cssFamily: 'Helvetica, Arial, sans-serif' },
  { value: 'times', label: 'Times', category: 'Clássicas', cssFamily: '"Times New Roman", Times, serif' },
  { value: 'courier', label: 'Courier', category: 'Clássicas', cssFamily: '"Courier New", Courier, monospace' },
  { value: 'roboto', label: 'Roboto', category: 'Sans-serif', cssFamily: 'Roboto, sans-serif' },
  { value: 'opensans', label: 'Open Sans', category: 'Sans-serif', cssFamily: '"Open Sans", sans-serif' },
  { value: 'lato', label: 'Lato', category: 'Sans-serif', cssFamily: 'Lato, sans-serif' },
  { value: 'montserrat', label: 'Montserrat', category: 'Sans-serif', cssFamily: 'Montserrat, sans-serif' },
  { value: 'poppins', label: 'Poppins', category: 'Sans-serif', cssFamily: 'Poppins, sans-serif' },
  { value: 'raleway', label: 'Raleway', category: 'Sans-serif', cssFamily: 'Raleway, sans-serif' },
  { value: 'nunito', label: 'Nunito', category: 'Sans-serif', cssFamily: 'Nunito, sans-serif' },
  { value: 'inter', label: 'Inter', category: 'Sans-serif', cssFamily: 'Inter, sans-serif' },
  { value: 'playfair', label: 'Playfair Display', category: 'Serifadas', cssFamily: '"Playfair Display", serif' },
  { value: 'merriweather', label: 'Merriweather', category: 'Serifadas', cssFamily: 'Merriweather, serif' },
];

/** Google Fonts CSS URL to load all custom fonts for preview */
export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=' +
  ['Inter', 'Lato', 'Merriweather', 'Montserrat', 'Nunito', 'Open+Sans', 'Playfair+Display', 'Poppins', 'Raleway', 'Roboto']
    .map(f => `${f}:wght@400;700`)
    .join('&family=') +
  '&display=swap';
