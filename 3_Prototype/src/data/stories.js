import { contacts } from './contacts';

function buildStorySvg(title, subtitle, colorA, colorB) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${colorA}" />
          <stop offset="100%" stop-color="${colorB}" />
        </linearGradient>
      </defs>
      <rect width="1080" height="1920" fill="url(#g)" />
      <circle cx="870" cy="260" r="180" fill="rgba(255,255,255,0.14)" />
      <circle cx="170" cy="1520" r="210" fill="rgba(255,255,255,0.12)" />
      <text x="96" y="220" fill="white" font-size="56" font-family="Arial" opacity="0.9">ТелеграфЪ • история</text>
      <text x="96" y="930" fill="white" font-size="104" font-family="Arial" font-weight="700">${title}</text>
      <text x="96" y="1060" fill="white" font-size="56" font-family="Arial" opacity="0.94">${subtitle}</text>
      <text x="96" y="1650" fill="white" font-size="42" font-family="Arial" opacity="0.88">Обновление из ленты историй</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const palette = [
  ['#2a447f', '#7e89d9'],
  ['#466d8f', '#91c0d8'],
  ['#6d5e93', '#b39ce8'],
  ['#2e6b68', '#75b8a7'],
  ['#8a5d6f', '#d396a9']
];

export const stories = contacts.slice(0, 5).map((contact, index) => {
  const [a, b] = palette[index % palette.length];

  return {
    id: `${contact.id}-story`,
    contactId: contact.id,
    name: contact.firstName,
    fullName: contact.fullName,
    role: contact.role,
    initials: contact.initials,
    image: buildStorySvg(contact.fullName, contact.role, a, b)
  };
});
