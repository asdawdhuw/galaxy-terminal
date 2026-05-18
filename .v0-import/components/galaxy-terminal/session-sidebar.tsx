"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Plus, Circle, ChevronRight, Settings, Trash2 } from "lucide-react"

interface Session {
  id: string
  name: string
  active: boolean
  status: "running" | "idle" | "stopped"
}

interface SessionSidebarProps {
  sessions: Session[]
  activeSession: string
  onSessionSelect: (id: string) => void
  onSessionCreate: () => void
  onSessionDelete: (id: string) => void
}

export function SessionSidebar({
  sessions,
  activeSession,
  onSessionSelect,
  onSessionCreate,
  onSessionDelete,
}: SessionSidebarProps) {
  const [hoveredSession, setHoveredSession] = useState<string | null>(null)

  return (
    <div className="w-64 h-full bg-sidebar/80 backdrop-blur-md border-r border-sidebar-border flex flex-col">
      {/* 头部 */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wider text-sidebar-foreground/70 uppercase">
            Sessions
          </h2>
          <button
            onClick={onSessionCreate}
            className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors group"
            title="新建会话"
          >
            <Plus className="w-4 h-4 text-sidebar-foreground/60 group-hover:text-sidebar-primary" />
          </button>
        </div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.map((session, index) => (
          <div
            key={session.id}
            className={cn(
              "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200",
              session.id === activeSession
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
            )}
            onClick={() => onSessionSelect(session.id)}
            onMouseEnter={() => setHoveredSession(session.id)}
            onMouseLeave={() => setHoveredSession(null)}
            style={{
              animationDelay: `${index * 50}ms`,
            }}
          >
            {/* 状态指示器 */}
            <div className="relative">
              <Circle
                className={cn(
                  "w-2.5 h-2.5 fill-current",
                  session.status === "running" && "text-green-400",
                  session.status === "idle" && "text-primary",
                  session.status === "stopped" && "text-muted-foreground"
                )}
              />
              {session.status === "running" && (
                <span className="absolute inset-0 animate-ping">
                  <Circle className="w-2.5 h-2.5 fill-green-400/30" />
                </span>
              )}
            </div>

            {/* 会话名称 */}
            <span className="flex-1 text-sm font-medium truncate">
              {session.name}
            </span>

            {/* 激活指示器 */}
            {session.id === activeSession && (
              <ChevronRight className="w-4 h-4 text-sidebar-primary" />
            )}

            {/* 删除按钮 */}
            {hoveredSession === session.id && sessions.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSessionDelete(session.id)
                }}
                className="absolute right-2 p-1 rounded hover:bg-destructive/20 transition-colors"
                title="删除会话"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 底部状态 */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between text-xs text-sidebar-foreground/50">
          <span>{sessions.length} 个会话</span>
          <button className="p-1.5 rounded hover:bg-sidebar-accent transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1 bg-sidebar-accent rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
              style={{
                width: `${Math.min(sessions.length * 20, 100)}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
