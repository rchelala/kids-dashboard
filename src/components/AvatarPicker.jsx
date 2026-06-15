export default function AvatarPicker({ onClose }) {
  return (
    <div className="avatar-picker-overlay" onClick={onClose}>
      <div className="avatar-picker-modal" onClick={e => e.stopPropagation()}>
        <p style={{ color: '#fff' }}>Picker coming soon — tap outside to close</p>
      </div>
    </div>
  )
}
