import { useState, useRef, useEffect, useCallback } from 'react'

export default function InputBar({ disabled, onFirstCommand }) {
  const [value, setValue] = useState('')
  const [isFirst, setIsFirst] = useState(true)
  const inputRef = useRef(null)
  const historyRef = useRef([])
  const historyIdxRef = useRef(-1)
  const tempRef = useRef('')

  const focus = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus()
    }
  }, [disabled])

  useEffect(() => { focus() }, [focus])

  useEffect(() => {
    function handleClick(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA') return
      focus()
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [focus])

  function send(data) {
    if (disabled) return
    window.terminal.sendInput(data)
  }

  function handleKeyDown(e) {
    if (disabled) return

    // Enter — send full command to PTY
    if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = value.trim()
      if (cmd) {
        historyRef.current.push(cmd)
        historyIdxRef.current = -1
      }
      // Send the full accumulated line + carriage return
      send(value + '\r')
      setValue('')
      if (isFirst && onFirstCommand) {
        setIsFirst(false)
        onFirstCommand()
      }
      return
    }

    // Ctrl+C — send interrupt immediately
    if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault()
      send('\x03')
      setValue('')
      return
    }

    // Ctrl+L — send clear screen
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      send('\x0c')
      return
    }

    // Ctrl+D — EOF on empty line
    if (e.key === 'd' && e.ctrlKey && value === '') {
      e.preventDefault()
      send('\x04')
      return
    }

    // Ctrl+U — clear line
    if (e.key === 'u' && e.ctrlKey) {
      e.preventDefault()
      setValue('')
      send('\x15')
      return
    }

    // History up — local only
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const hist = historyRef.current
      if (hist.length === 0) return
      if (historyIdxRef.current === -1) {
        tempRef.current = value
        historyIdxRef.current = hist.length - 1
      } else if (historyIdxRef.current > 0) {
        historyIdxRef.current--
      }
      setValue(hist[historyIdxRef.current])
      return
    }

    // History down
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const hist = historyRef.current
      if (historyIdxRef.current === -1) return
      if (historyIdxRef.current < hist.length - 1) {
        historyIdxRef.current++
        setValue(hist[historyIdxRef.current])
      } else {
        historyIdxRef.current = -1
        setValue(tempRef.current)
      }
      return
    }

    // Backspace
    if (e.key === 'Backspace') {
      e.preventDefault()
      setValue(v => v.slice(0, -1))
      return
    }

    // Printable characters — local echo only
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault()
      setValue(v => v + e.key)
      return
    }
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-t-2 border-black/60 shrink-0 cursor-text"
      style={{ background: 'rgba(8, 8, 24, 0.4)' }}
      onClick={focus}
    >
      <span className="text-cosmos-accent text-sm font-mono shrink-0 select-none">{'>'}</span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        readOnly
        onKeyDown={handleKeyDown}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        className="flex-1 bg-transparent outline-none text-sm text-cosmos-text font-mono
                   caret-cosmos-accent"
        placeholder="Type a command..."
      />
    </div>
  )
}
