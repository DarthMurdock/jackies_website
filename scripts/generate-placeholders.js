// One-time helper: generates the starter placeholder images used by content/content.json.
// Run with: node scripts/generate-placeholders.js
// Safe to delete once Jackie has uploaded real photos for every piece.
const fs = require('fs');
const path = require('path');

const ICONS = {
  needle: `<line x1="8" y1="24" x2="23" y2="9"/><ellipse cx="24.5" cy="7.5" rx="2.2" ry="3.2" transform="rotate(45 24.5 7.5)"/><path d="M8 24 C4 22 4 18 6 16 C8 14 11 15 11 18"/>`,
  film: `<rect x="4" y="6" width="24" height="20" rx="1.5"/><line x1="4" y1="12" x2="10" y2="12"/><line x1="4" y1="20" x2="10" y2="20"/><line x1="22" y1="12" x2="28" y2="12"/><line x1="22" y1="20" x2="28" y2="20"/><rect x="12" y="10" width="8" height="12" rx="1"/>`,
  camera: `<rect x="4" y="10" width="24" height="16" rx="2"/><path d="M11 10 L13 7 H19 L21 10"/><circle cx="16" cy="18" r="5"/>`,
  moth: `<path d="M16 8 C16 8 14 4 10 5 C7 6 6 10 9 12 C11 13.5 14 12 16 15"/><path d="M16 8 C16 8 18 4 22 5 C25 6 26 10 23 12 C21 13.5 18 12 16 15"/><circle cx="11.5" cy="8.3" r="1.3" fill="currentColor" stroke="none"/><circle cx="20.5" cy="8.3" r="1.3" fill="currentColor" stroke="none"/><path d="M16 15 L16 26"/><path d="M16 15 C16 15 12 17 11 21 C10.3 24 12 26 14.5 25.5"/><path d="M16 15 C16 15 20 17 21 21 C21.7 24 20 26 17.5 25.5"/><path d="M14.5 7 L13 4"/><path d="M17.5 7 L19 4"/>`,
  sparkle: `<path d="M16 4 L18 13 L27 15 L18 17 L16 26 L14 17 L5 15 L14 13 Z"/>`,
};

const PLACEHOLDERS = [
  { file: 'embroidery-study-no-4.svg', icon: 'needle', label: 'Embroidery Study No. 4' },
  { file: 'nocturne-still.svg', icon: 'film', label: 'Nocturne (still)' },
  { file: 'attic-light.svg', icon: 'camera', label: 'Attic Light' },
  { file: 'luna-moth-ii.svg', icon: 'moth', label: 'Luna Moth, ii' },
  { file: 'something-new.svg', icon: 'sparkle', label: 'Something New' },
  { file: 'field-notes-polyphemus.svg', icon: 'moth', label: 'Field Notes: Polyphemus' },
  { file: 'hero-specimen.svg', icon: 'moth', label: "Luna Moth — Gilded Study" },
];

const outDir = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(outDir, { recursive: true });

for (const p of PLACEHOLDERS) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#1B453C"/>
  <rect x="0.5" y="0.5" width="399" height="399" fill="none" stroke="#3E6157"/>
  <g transform="translate(140,120) scale(3.75)" fill="none" stroke="#C9A24B" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round">
    ${ICONS[p.icon]}
  </g>
  <text x="200" y="330" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="17" fill="#F4E8C9">${p.label}</text>
  <text x="200" y="356" text-anchor="middle" font-family="monospace" font-size="10" letter-spacing="1" fill="#B9A77C">PLACEHOLDER — REPLACE IN /ADMIN</text>
</svg>`;
  fs.writeFileSync(path.join(outDir, p.file), svg, 'utf8');
  console.log('wrote', p.file);
}
