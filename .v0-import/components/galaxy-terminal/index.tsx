"use client"

import { useState, useEffect, useCallback } from "react"
import { Starfield } from "./starfield"
import { Terminal } from "./terminal"
import { SessionSidebar } from "./session-sidebar"
import { TopBar } from "./top-bar"
import { cn } from "@/lib/utils"

interface Session {
  id: string
  name: string
  active: boolean
  status: "running" | "idle" | "stopped"
}

export function GalaxyTerminal() {
  const [sessions, setSessions] = useState<Session[]>([
    { id: "1", name: "session_1", active: true, status: "running" },
  ])
  const [activeSession, setActiveSession] = useState("1")
  const [currentTime, setCurrentTime] = useState("")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showScanLine, setShowScanLine] = useState(true)

  // 更新时间
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      )
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + T 新建会话
      if ((e.ctrlKey || e.metaKey) && e.key === "t") {
        e.preventDefault()
        handleCreateSession()
      }
      // Ctrl/Cmd + W 关闭会话
      if ((e.ctrlKey || e.metaKey) && e.key === "w") {
        e.preventDefault()
        if (sessions.length > 1) {
          handleDeleteSession(activeSession)
        }
      }
      // F11 全屏
      if (e.key === "F11") {
        e.preventDefault()
        toggleFullscreen()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeSession, sessions.length])

  const handleCreateSession = useCallback(() => {
    const newId = `${Date.now()}`
    const newSession: Session = {
      id: newId,
      name: `session_${sessions.length + 1}`,
      active: true,
      status: "idle",
    }
    setSessions((prev) =>
      prev.map((s) => ({ ...s, active: false })).concat(newSession)
    )
    setActiveSession(newId)
  }, [sessions.length])

  const handleDeleteSession = useCallback(
    (id: string) => {
      if (sessions.length <= 1) return
      const remaining = sessions.filter((s) => s.id !== id)
      setSessions(remaining)
      if (activeSession === id) {
        setActiveSession(remaining[0].id)
      }
    },
    [sessions, activeSession]
  )

  const handleSessionSelect = useCallback((id: string) => {
    setSessions((prev) =>
      prev.map((s) => ({
        ...s,
        active: s.id === id,
        status: s.id === id ? "running" : s.status === "running" ? "idle" : s.status,
      }))
    )
    setActiveSession(id)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  const currentSession = sessions.find((s) => s.id === activeSession)

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      {/* 银河系背景图 */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80')",
        }}
      />

      {/* 星空粒子层 */}
      <Starfield />

      {/* 扫描线效果 */}
      {showScanLine && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 2 }}>
          <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-scan-line" />
        </div>
      )}

      {/* 星云渐变遮罩 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(100, 150, 255, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(200, 100, 255, 0.08) 0%, transparent 50%)",
          zIndex: 2,
        }}
      />

      {/* 主内容区 */}
      <div className="relative z-10 h-full flex flex-col">
        {/* 顶部栏 */}
        <TopBar
          currentTime={currentTime}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />

        {/* 主体区域 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 侧边栏 */}
          <SessionSidebar
            sessions={sessions}
            activeSession={activeSession}
            onSessionSelect={handleSessionSelect}
            onSessionCreate={handleCreateSession}
            onSessionDelete={handleDeleteSession}
          />

          {/* 终端区域 */}
          <div className="flex-1 p-4 overflow-hidden">
            <Terminal sessionName={currentSession?.name} />
          </div>
        </div>

        {/* 底部状态栏 */}
        <div className="h-7 bg-card/30 backdrop-blur-md border-t border-border/30 flex items-center justify-between px-4 text-xs">
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              {sessions.length} 个会话
            </span>
            <span>·</span>
            <span>当前: {currentSession?.name}</span>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <button
              onClick={() => setShowScanLine(!showScanLine)}
              className={cn(
                "hover:text-foreground transition-colors",
                !showScanLine && "line-through opacity-50"
              )}
            >
              扫描线
            </button>
            <span>|</span>
            <span>快捷键: Ctrl+T 新建 · Ctrl+W 关闭</span>
          </div>
        </div>
      </div>

      {/* 边框光晕 */}
      <div
        className="absolute inset-0 pointer-events-none border border-primary/10 rounded-lg"
        style={{ zIndex: 20 }}
      />
    </div>
  )
}
