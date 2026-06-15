// Color palette per color name
export const COLOR_MAP = {
  purple: { light: '#ddd6fe', mid: '#c4b5fd', dark: '#a78bfa', pupil: '#4c1d95', mouth: '#7c3aed' },
  blue:   { light: '#bfdbfe', mid: '#93c5fd', dark: '#60a5fa', pupil: '#1e3a8a', mouth: '#1d4ed8' },
  green:  { light: '#a7f3d0', mid: '#6ee7b7', dark: '#34d399', pupil: '#065f46', mouth: '#059669' },
  orange: { light: '#fed7aa', mid: '#fdba74', dark: '#fb923c', pupil: '#7c2d12', mouth: '#c2410c' },
  pink:   { light: '#fbcfe8', mid: '#f9a8d4', dark: '#ec4899', pupil: '#831843', mouth: '#be185d' },
}

export function MushroomHead({ c }) {
  return (
    <svg className="avatar-svg" viewBox="0 0 44 62" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="22" cy="60" rx="9" ry="2.5" fill={c.dark} opacity="0.3" />
      <rect x="15" y="38" width="14" height="16" rx="4" fill={c.mid} />
      <line x1="15" y1="44" x2="6" y2="51" stroke={c.dark} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="29" y1="44" x2="38" y2="51" stroke={c.dark} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="19" y1="54" x2="17" y2="63" stroke={c.dark} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="25" y1="54" x2="27" y2="63" stroke={c.dark} strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="22" cy="27" rx="14" ry="13" fill={c.light} />
      <circle cx="17" cy="26" r="4" fill="white" />
      <circle cx="27" cy="26" r="4" fill="white" />
      <circle cx="18" cy="26.5" r="2" fill={c.pupil} />
      <circle cx="28" cy="26.5" r="2" fill={c.pupil} />
      <path d="M 17 33 Q 22 37 27 33" stroke={c.mouth} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function Robot({ c }) {
  return (
    <svg className="avatar-svg" viewBox="0 0 44 62" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="22" cy="60" rx="9" ry="2.5" fill={c.dark} opacity="0.3" />
      <rect x="13" y="36" width="18" height="18" rx="3" fill={c.mid} />
      <rect x="17" y="40" width="10" height="6" rx="2" fill={c.light} opacity="0.6" />
      <circle cx="20" cy="43" r="1.5" fill={c.dark} />
      <circle cx="24" cy="43" r="1.5" fill="#f87171" />
      <rect x="5" y="37" width="7" height="10" rx="3" fill={c.dark} />
      <rect x="32" y="37" width="7" height="10" rx="3" fill={c.dark} />
      <rect x="15" y="53" width="5" height="9" rx="2.5" fill={c.dark} />
      <rect x="24" y="53" width="5" height="9" rx="2.5" fill={c.dark} />
      <rect x="10" y="17" width="24" height="20" rx="5" fill={c.light} />
      <line x1="22" y1="17" x2="22" y2="10" stroke={c.dark} strokeWidth="2" strokeLinecap="round" />
      <circle cx="22" cy="8" r="3" fill="#ffd700" />
      <rect x="14" y="22" width="7" height="7" rx="1.5" fill="white" />
      <rect x="23" y="22" width="7" height="7" rx="1.5" fill="white" />
      <rect x="16" y="23.5" width="3" height="4" rx="1" fill={c.pupil} />
      <rect x="25" y="23.5" width="3" height="4" rx="1" fill={c.pupil} />
      <rect x="16" y="32" width="12" height="2.5" rx="1.5" fill={c.dark} opacity="0.5" />
    </svg>
  )
}

export function Ghost({ c }) {
  return (
    <svg className="avatar-svg" viewBox="0 0 44 66" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="22" cy="64" rx="10" ry="3" fill={c.dark} opacity="0.15" />
      <ellipse cx="5" cy="34" rx="4" ry="6" fill={c.mid} />
      <ellipse cx="39" cy="34" rx="4" ry="6" fill={c.mid} />
      <path d="M 8 22 Q 8 4 22 4 Q 36 4 36 22 L 36 52 Q 32 48 28 52 Q 24 56 22 52 Q 20 48 16 52 Q 12 56 8 52 Z" fill={c.light} />
      <circle cx="16" cy="26" r="5" fill="white" />
      <circle cx="28" cy="26" r="5" fill="white" />
      <circle cx="17" cy="27" r="2.5" fill={c.pupil} />
      <circle cx="29" cy="27" r="2.5" fill={c.pupil} />
      <circle cx="18" cy="25.5" r="1" fill="white" opacity="0.9" />
      <circle cx="30" cy="25.5" r="1" fill="white" opacity="0.9" />
      <circle cx="22" cy="36" r="3" fill={c.mouth} opacity="0.5" />
    </svg>
  )
}

export function Cat({ c }) {
  return (
    <svg className="avatar-svg" viewBox="0 0 44 62" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="22" cy="60" rx="9" ry="2.5" fill={c.dark} opacity="0.3" />
      <rect x="14" y="37" width="16" height="17" rx="5" fill={c.mid} />
      <line x1="14" y1="43" x2="5" y2="49" stroke={c.dark} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="30" y1="43" x2="39" y2="49" stroke={c.dark} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="18" y1="54" x2="16" y2="63" stroke={c.dark} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="26" y1="54" x2="28" y2="63" stroke={c.dark} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 30 50 Q 42 46 40 38" stroke={c.dark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <ellipse cx="22" cy="27" rx="13" ry="12" fill={c.light} />
      <polygon points="10,20 8,8 17,16" fill={c.mid} />
      <polygon points="34,20 36,8 27,16" fill={c.mid} />
      <polygon points="11,19 10,11 16,16" fill="#f9a8d4" opacity="0.6" />
      <polygon points="33,19 34,11 28,16" fill="#f9a8d4" opacity="0.6" />
      <circle cx="17" cy="27" r="4" fill="white" />
      <circle cx="27" cy="27" r="4" fill="white" />
      <ellipse cx="17.5" cy="27.5" rx="2" ry="2.5" fill={c.pupil} />
      <ellipse cx="27.5" cy="27.5" rx="2" ry="2.5" fill={c.pupil} />
      <circle cx="18" cy="26.5" r="1" fill="white" opacity="0.8" />
      <circle cx="28" cy="26.5" r="1" fill="white" opacity="0.8" />
      <ellipse cx="22" cy="32" rx="2" ry="1.5" fill="#f9a8d4" />
      <line x1="10" y1="31" x2="19" y2="32" stroke={c.dark} strokeWidth="1" opacity="0.5" />
      <line x1="25" y1="32" x2="34" y2="31" stroke={c.dark} strokeWidth="1" opacity="0.5" />
      <path d="M 19 34 Q 22 37 25 34" stroke={c.mouth} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export const CHAR_MAP = { mushroom: MushroomHead, robot: Robot, ghost: Ghost, cat: Cat }

// Ghost drifts, others bob
export const IDLE_ANIM = { mushroom: 'bob', robot: 'bob', ghost: 'drift', cat: 'bob' }
