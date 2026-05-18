"use client"

import { useState, useRef, useEffect } from "react"
import {
  Search,
  Music,
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Clock,
  Wifi,
  Battery,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface TopBarProps {
  currentTime: string
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

export function TopBar({
  currentTime,
  isFullscreen = false,
  onToggleFullscreen,
}: TopBarProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [volume, setVolume] = useState(75)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showSearch])

  return (
    <div className="h-12 bg-card/30 backdrop-blur-md border-b border-border/30 flex items-center justify-between px-4">
      {/* 左侧 - 搜索和音乐 */}
      <div className="flex items-center gap-3">
        {/* 搜索框 */}
        <div
          className={cn(
            "flex items-center gap-2 bg-secondary/50 rounded-full transition-all duration-300 overflow-hidden",
            showSearch ? "w-64 px-3 py-1.5" : "w-auto px-2 py-1.5"
          )}
        >
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="shrink-0"
          >
            <Search className="w-4 h-4 text-muted-foreground" />
          </button>
          {showSearch && (
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索命令..."
              className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
              onBlur={() => !searchQuery && setShowSearch(false)}
            />
          )}
          {!showSearch && (
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Music
            </span>
          )}
        </div>

        {/* 音乐播放器 */}
        <div className="flex items-center gap-1 bg-secondary/30 rounded-full px-2 py-1">
          <button
            className="p-1 hover:bg-secondary/50 rounded-full transition-colors"
            onClick={() => {}}
          >
            <SkipBack className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            className="p-1.5 hover:bg-secondary/50 rounded-full transition-colors"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-primary" />
            ) : (
              <Play className="w-4 h-4 text-primary" />
            )}
          </button>
          <button
            className="p-1 hover:bg-secondary/50 rounded-full transition-colors"
            onClick={() => {}}
          >
            <SkipForward className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* 当前播放 */}
        {isPlaying && (
          <div className="flex items-center gap-2 text-xs animate-in fade-in slide-in-from-left-2">
            <Music className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="text-muted-foreground">
              Interstellar Theme - Hans Zimmer
            </span>
          </div>
        )}
      </div>

      {/* 中间 - 标题栏区域 */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
        <div className="flex items-center gap-2 bg-secondary/40 rounded-full px-4 py-1.5">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center">
            <span className="text-xs font-bold text-white">⌘</span>
          </div>
          <span className="text-sm text-foreground/80 font-medium">~</span>
          <span className="text-xs text-muted-foreground mx-1">|</span>
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-mono text-foreground/80">
            {currentTime}
          </span>
        </div>
      </div>

      {/* 右侧 - 状态和控制 */}
      <div className="flex items-center gap-4">
        {/* 音量控制 */}
        <div className="flex items-center gap-2 group">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1 hover:bg-secondary/50 rounded transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <div className="w-0 overflow-hidden group-hover:w-20 transition-all duration-300">
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseInt(e.target.value))
                if (isMuted) setIsMuted(false)
              }}
              className="w-full h-1 bg-secondary/50 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
        </div>

        {/* 状态图标 */}
        <div className="flex items-center gap-3 text-muted-foreground">
          <Wifi className="w-4 h-4" />
          <div className="flex items-center gap-1">
            <Battery className="w-4 h-4" />
            <span className="text-xs">100%</span>
          </div>
        </div>

        {/* 音频选择 */}
        <button className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
          <Music className="w-4 h-4" />
          <span className="uppercase tracking-wider">Audio</span>
          <span className="text-muted-foreground">▾</span>
        </button>

        {/* 全屏切换 */}
        <button
          onClick={onToggleFullscreen}
          className="p-1.5 hover:bg-secondary/50 rounded transition-colors"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Maximize2 className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  )
}
