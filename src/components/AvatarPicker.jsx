import { useState } from 'react'
import { COLOR_MAP, CHAR_MAP } from './avatars'

const CHARACTERS = [
  { type: 'mushroom', label: 'Mushroom', emoji: '🍄' },
  { type: 'robot',    label: 'Robot',    emoji: '🤖' },
  { type: 'ghost',    label: 'Ghost',    emoji: '👻' },
  { type: 'cat',      label: 'Cat',      emoji: '🐱' },
]

const COLORS = [
  { name: 'purple', swatch: '#a78bfa' },
  { name: 'blue',   swatch: '#60a5fa' },
  { name: 'green',  swatch: '#34d399' },
  { name: 'orange', swatch: '#fb923c' },
  { name: 'pink',   swatch: '#ec4899' },
]

export default function AvatarPicker({ current, onSave, onClose }) {
  const [preview, setPreview] = useState(current)

  const PreviewChar = CHAR_MAP[preview.type] || CHAR_MAP.mushroom
  const previewColors = COLOR_MAP[preview.color] || COLOR_MAP.purple

  return (
    <div className="avatar-picker-overlay" onClick={onClose}>
      <div className="avatar-picker-modal" onClick={e => e.stopPropagation()}>
        <h2 className="avatar-picker-title">Pick your character!</h2>

        <div className="avatar-picker-preview avatar-anim-bob">
          <PreviewChar c={previewColors} />
        </div>

        <div className="avatar-picker-chars">
          {CHARACTERS.map(ch => (
            <button
              key={ch.type}
              className={`avatar-char-btn${preview.type === ch.type ? ' selected' : ''}`}
              onClick={() => setPreview(p => ({ ...p, type: ch.type }))}
            >
              <span style={{ fontSize: 28 }}>{ch.emoji}</span>
              <span>{ch.label}</span>
            </button>
          ))}
        </div>

        <div className="avatar-picker-colors">
          {COLORS.map(({ name, swatch }) => (
            <button
              key={name}
              className={`avatar-color-swatch${preview.color === name ? ' selected' : ''}`}
              style={{ background: swatch }}
              onClick={() => setPreview(p => ({ ...p, color: name }))}
              aria-label={name}
            />
          ))}
        </div>

        <button className="avatar-picker-confirm" onClick={() => onSave(preview)}>
          That's me! ✓
        </button>
      </div>
    </div>
  )
}
