import { useState, useEffect, useRef } from 'react'
import { COLOR_MAP, CHAR_MAP, IDLE_ANIM } from './avatars'
import AvatarPicker from './AvatarPicker'

function loadAvatar(kidId) {
  try { return JSON.parse(localStorage.getItem(`avatar_${kidId}`)) } catch { return null }
}

function saveAvatar(kidId, avatar) {
  localStorage.setItem(`avatar_${kidId}`, JSON.stringify(avatar))
}

export default function AvatarCharacter({ kidId, alarmActive, choreState, lastChoreAt, justLoggedIn }) {
  const [avatar, setAvatar] = useState(() => loadAvatar(kidId) || { type: 'mushroom', color: 'purple' })
  const [isFirstChoice, setIsFirstChoice] = useState(() => !loadAvatar(kidId))
  const [showPicker, setShowPicker] = useState(false)
  const [visualState, setVisualState] = useState('idle')
  const lastTapRef = useRef(0)
  const cheerTimerRef = useRef(null)
  const danceShownRef = useRef(false)

  // Reload avatar when kid switches
  useEffect(() => {
    const saved = loadAvatar(kidId)
    setAvatar(saved || { type: 'mushroom', color: 'purple' })
    setIsFirstChoice(!saved)
  }, [kidId])

  // Animation state machine — priority order matches spec
  useEffect(() => {
    clearTimeout(cheerTimerRef.current)

    if (alarmActive) { setVisualState('dodge'); return }

    if (lastChoreAt && (Date.now() - lastChoreAt) < 2000) {
      setVisualState('cheer')
      const remaining = 2000 - (Date.now() - lastChoreAt)
      cheerTimerRef.current = setTimeout(() => {
        setVisualState(() => {
          if (choreState === 'all') return 'dance'
          if (choreState === 'none') return 'sad'
          return 'idle'
        })
      }, remaining)
      return
    }

    if (choreState === 'all') {
      if (!danceShownRef.current) {
        danceShownRef.current = true
        setVisualState('dance')
        cheerTimerRef.current = setTimeout(() => setVisualState('idle'), 1500)
      } else {
        setVisualState('idle')
      }
      return
    }
    danceShownRef.current = false
    if (justLoggedIn)          { setVisualState('wave');  return }
    if (choreState === 'none') { setVisualState('sad');   return }
    setVisualState('idle')

    return () => clearTimeout(cheerTimerRef.current)
  }, [alarmActive, choreState, lastChoreAt, justLoggedIn])

  function handleTap() {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0
      setShowPicker(true)
    } else {
      lastTapRef.current = now
    }
  }

  function handleSave(newAvatar) {
    setAvatar(newAvatar)
    saveAvatar(kidId, newAvatar)
    setIsFirstChoice(false)
    setShowPicker(false)
  }

  const c = COLOR_MAP[avatar.color] || COLOR_MAP.purple
  const CharSvg = CHAR_MAP[avatar.type] || CHAR_MAP.mushroom
  const idleClass = `avatar-anim-${IDLE_ANIM[avatar.type] || 'bob'}`
  const animClass = (visualState === 'idle' || visualState === 'dodge') ? idleClass : `avatar-anim-${visualState}`

  return (
    <>
      <div
        className={`avatar-container${visualState === 'dodge' ? ' avatar-dodging' : ''}`}
        onClick={handleTap}
        title="Double-tap to change character"
      >
        <div className={animClass}>
          <CharSvg c={c} />
        </div>
        {isFirstChoice && <span className="avatar-sparkle-hint">✨</span>}
      </div>

      {showPicker && (
        <AvatarPicker
          current={avatar}
          onSave={handleSave}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
