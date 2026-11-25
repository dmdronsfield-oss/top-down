// Portraits for the supporting cast, drawn in the same flat, inked manner as the main four.
const INK = '#1F1C2B';
function hatSvg(kind, col) {
  switch (kind) {
    case 'bowler': return `<path d="M58 92 C58 50 142 50 142 92 Z" fill="${col}"/><path d="M40 94 C70 84 130 84 160 94 C130 100 70 100 40 94 Z" fill="${col}"/>`;
    case 'topper': return `<path d="M66 92 L70 28 L130 28 L134 92 Z" fill="${col}"/><path d="M42 94 C70 86 130 86 158 94 C130 100 70 100 42 94 Z" fill="${col}"/><path d="M68 80 L132 80 L133 90 L67 90 Z" fill="#3a3640"/>`;
    case 'homburg': return `<path d="M62 92 L66 50 C80 40 120 40 134 50 L138 92 Z" fill="${col}"/><path d="M84 46 C95 54 105 54 116 46" fill="none"/><path d="M40 94 C70 84 130 84 160 94 C130 102 70 102 40 94 Z" fill="${col}"/>`;
    case 'cap': return `<path d="M56 92 C56 58 144 54 148 86 L150 94 Z" fill="${col}"/><path d="M60 92 C80 102 130 104 158 92 L150 86 Z" fill="${col}"/>`;
    case 'cloche': return `<path d="M52 108 C48 52 152 52 148 108 C130 96 70 96 52 108 Z" fill="${col}"/>`;
    case 'toque': return `<path d="M64 88 L66 46 L134 46 L136 88 Z" fill="${col}"/><path d="M128 48 C140 20 160 18 158 10 C150 30 140 40 132 50 Z" fill="#E8E2D4"/>`;
    default: return '';
  }
}
export function portrait(o) {
  const skin = o.skin || '#EBC9A8', hair = o.hair || '#4a3122', coat = o.coat || '#2a2a33', bg = o.bg || '#E5D9BE', disc = o.disc || '#8FA3B5';
  const female = !!o.female;
  return `<svg viewBox="0 0 200 240" role="img" aria-label="${o.label || 'Portrait'}"><rect width="200" height="240" fill="${bg}"/><circle cx="100" cy="112" r="86" fill="${disc}"/>
<g stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
<path d="M22 240 C30 196 52 178 82 170 L118 170 C148 178 170 196 178 240 Z" fill="${coat}"/>
${o.collar === false ? '' : `<path d="M86 160 L100 180 L114 160 L113 172 L100 186 L87 172 Z" fill="${o.shirt || '#F4EEE0'}"/>`}
${o.tie ? `<path d="M96 180 L104 180 L107 206 L100 214 L93 206 Z" fill="${o.tie}"/>` : ''}
<path d="M88 144 L88 168 L112 168 L112 144 Z" fill="${skin}"/>
${female ? `<path d="M56 120 C50 60 150 60 144 120 C150 150 136 160 130 150 L130 110 L70 110 L70 150 C64 160 50 150 56 120 Z" fill="${hair}"/>` : ''}
<ellipse cx="100" cy="116" rx="${female ? 28 : 31}" ry="38" fill="${skin}"/>
${female ? '' : `<path d="M69 108 C66 76 134 76 131 108 C124 92 76 92 69 108 Z" fill="${hair}"/>`}
<path d="M84 112 L94 110 M106 110 L116 112" fill="none"/>
<circle cx="89" cy="118" r="2.6" fill="${INK}"/><circle cx="111" cy="118" r="2.6" fill="${INK}"/>
${o.spectacles ? '<circle cx="89" cy="118" r="8" fill="none" stroke="#B8923C"/><circle cx="111" cy="118" r="8" fill="none" stroke="#B8923C"/><path d="M97 118 L103 118" stroke="#B8923C"/>' : ''}
<path d="M100 120 L97 132 L102 133" fill="none"/>
${o.moustache ? `<path d="M86 139 C92 134 98 136 100 138 C102 136 108 134 114 139 C108 142 92 142 86 139 Z" fill="${o.moustache}"/>` : ''}
<path d="M92 ${o.frown ? 146 : 143} C97 ${o.frown ? 142 : 147} 103 ${o.frown ? 142 : 147} 108 ${o.frown ? 146 : 143}" fill="none"/>
${female && o.lips ? `<path d="M93 144 C97 141 103 141 107 144 C103 147 97 147 93 144 Z" fill="${o.lips}"/>` : ''}
${hatSvg(o.hat, o.hatCol || '#1b1a20')}
${o.extra || ''}
</g></svg>`;
}

export const EXTRA = {
  gossage: portrait({ label: 'Mr Gossage', coat: '#5a4632', hair: '#C7C2B8', spectacles: true, tie: '#2a3a2a', disc: '#B5A17A', skin: '#EFCFB6' }),
  tresham: portrait({ label: 'Mr Tresham', coat: '#26242c', hair: '#1a1716', hat: 'homburg', hatCol: '#3b3a42', moustache: '#1a1716', tie: '#4a1a1a', disc: '#7E8A9C', frown: true }),
  ollerenshaw: portrait({ label: 'Mr Ollerenshaw', coat: '#111015', hair: '#D0B070', hat: 'topper', hatCol: '#111015', tie: '#111015', disc: '#C9A44C', skin: '#F2C9B0' }),
  fitch: portrait({ label: 'Fitch, hall porter', coat: '#1d3b2f', hair: '#B8B2A6', hat: 'topper', hatCol: '#1d3b2f', moustache: '#9a958c', tie: '#C9A24C', disc: '#6E8F7A' }),
  nanny: portrait({ label: 'Nurse Pollard', female: true, coat: '#5d6878', hair: '#5a3c26', hat: 'cloche', hatCol: '#2a3040', disc: '#A9B8A0', lips: '#B5534E', shirt: '#F4EEE0' }),
  colonel: portrait({ label: 'Colonel Fothergill-Pym', coat: '#6a5838', hair: '#DEDAD0', hat: 'cap', hatCol: '#6a5838', moustache: '#E8E2D4', tie: '#6a1f1f', disc: '#B97A5A', skin: '#E8A890' }),
  cabbie: portrait({ label: 'A cabman', coat: '#3f3326', hair: '#4a3122', hat: 'cap', hatCol: '#3f3326', disc: '#9C8B6A', skin: '#D9A882', tie: '#6a5a3c' }),
  magistrate: portrait({ label: 'The magistrate', coat: '#1b1a20', hair: '#E8E2D4', disc: '#8C2B2B', spectacles: true, frown: true, tie: '#F4EEE0', extra: '<path d="M60 96 C56 140 64 170 70 176 L74 120 Z M140 96 C144 140 136 170 130 176 L126 120 Z" fill="#E8E2D4"/>' }),
  hatter: portrait({ label: 'Mr Pargeter', coat: '#1c2742', hair: '#6b4a2e', hat: 'bowler', hatCol: '#1b1a20', tie: '#8C2B2B', disc: '#C9A44C', moustache: '#6b4a2e' }),
  landlord: portrait({ label: 'The landlord', coat: '#F4EEE0', collar: false, hair: '#2a1d15', moustache: '#2a1d15', disc: '#8C2B2B', skin: '#E3A883' }),
  pig: `<svg viewBox="0 0 200 240" role="img" aria-label="Hyacinth, a pig"><rect width="200" height="240" fill="#E5D9BE"/><circle cx="100" cy="112" r="86" fill="#7FA0C8"/><g stroke="#1F1C2B" stroke-width="2.5" stroke-linejoin="round"><ellipse cx="100" cy="150" rx="70" ry="60" fill="#E7B3A5"/><path d="M52 80 L70 112 L84 92 Z M148 80 L130 112 L116 92 Z" fill="#E7B3A5"/><ellipse cx="100" cy="160" rx="26" ry="18" fill="#D99A8E"/><circle cx="92" cy="160" r="4" fill="#1F1C2B"/><circle cx="108" cy="160" r="4" fill="#1F1C2B"/><circle cx="80" cy="128" r="4" fill="#1F1C2B"/><circle cx="120" cy="128" r="4" fill="#1F1C2B"/><path d="M60 200 C80 190 120 190 140 200" fill="none" stroke="#2A4FA8" stroke-width="8"/></g></svg>`,
};
