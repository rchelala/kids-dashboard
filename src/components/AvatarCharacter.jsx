import { useState, useEffect, useRef } from 'react'
import { COLOR_MAP, CHAR_MAP, IDLE_ANIM } from './avatars'
import AvatarPicker from './AvatarPicker'

function loadAvatar(kidId) {
  try { return JSON.parse(localStorage.getItem(`avatar_${kidId}`)) } catch { return null }
}

function saveAvatar(kidId, avatar) {
  try { localStorage.setItem(`avatar_${kidId}`, JSON.stringify(avatar)) } catch {}
}

export default function AvatarCharacter({ kidId, alarmActive, choreState, lastChoreAt, justLoggedIn }) {
  const initialAvatar = loadAvatar(kidId)
  const [avatar, setAvatar] = useState(initialAvatar || { type: 'mushroom', color: 'purple' })
  const [isFirstChoice, setIsFirstChoice] = useState(!initialAvatar)
  const [showPicker, setShowPicker] = useState(false)
  const [visualState, setVisualState] = useState('idle')
  const lastTapRef = useRef(0)
  const cheerTimerRef = useRef(null)
  const danceShownRef = useRef(false) // prevents dance replaying while choreState stays 'all'

  // Reload avatar when kid switches
  useEffect(() => {
    const saved = loadAvatar(kidId)
    setAvatar(saved || { type: 'mushroom', color: 'purple' })
    setIsFirstChoice(!saved)
  }, [kidId])

  // Animation state machine — priority order matches spec
  useEffect(() => {
    clearTimeout(cheerTimerRef.current)
    cheerTimerRef.current = null

    if (alarmActive) {
      danceShownRef.current = false
      setVisualState('dodge')
    } else if (lastChoreAt && (Date.now() - lastChoreAt) < 2000) {
      setVisualState('cheer')
      const remaining = 2000 - (Date.now() - lastChoreAt)
      cheerTimerRef.current = setTimeout(() => {
        setVisualState(() => {
          if (choreState === 'all') return 'dance'
          if (choreState === 'none') return 'sad'
          return 'idle'
        })
      }, remaining)
    } else if (choreState === 'all') {
      if (!danceShownRef.current) {
        danceShownRef.current = true
        setVisualState('dance')
        cheerTimerRef.current = setTimeout(() => setVisualState('idle'), 1500)
      } else {
        setVisualState('idle')
      }
    } else {
      danceShownRef.current = false
      if (justLoggedIn)               setVisualState('wave')
      else if (choreState === 'none') setVisualState('sad')
      else                            setVisualState('idle')
    }

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
