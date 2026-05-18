"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"

interface TerminalLine {
  id: number
  type: "input" | "output" | "error" | "success" | "system"
  content: string
  timestamp: Date
}

interface TerminalProps {
  sessionName?: string
}

const WELCOME_MESSAGE = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     ██████╗  █████╗ ██╗      █████╗ ██╗  ██╗██╗   ██╗       ║
║    ██╔════╝ ██╔══██╗██║     ██╔══██╗╚██╗██╔╝╚██╗ ██╔╝       ║
║    ██║  ███╗███████║██║     ███████║ ╚███╔╝  ╚████╔╝        ║
║    ██║   ██║██╔══██║██║     ██╔══██║ ██╔██╗   ╚██╔╝         ║
║    ╚██████╔╝██║  ██║███████╗██║  ██║██╔╝ ██╗   ██║          ║
║     ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝          ║
║                                                              ║
║          ✨ 欢迎来到银河终端 v2.0 ✨                          ║
║                                                              ║
║    输入 'help' 查看可用命令                                   ║
║    输入 'theme' 切换主题效果                                  ║
║    输入 'clear' 清空终端                                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`

const COMMANDS: Record<string, string> = {
  help: `
可用命令:
  help     - 显示帮助信息
  clear    - 清空终端
  date     - 显示当前日期时间
  echo     - 回显文本
  whoami   - 显示当前用户
  neofetch - 系统信息
  theme    - 切换主题效果
  matrix   - 黑客帝国效果
  stars    - 显示星座信息
  ls       - 列出文件
  pwd      - 显示当前目录
  cat      - 读取文件内容
`,
  whoami: "🚀 space_explorer@galaxy-terminal",
  pwd: "/home/cosmos/nebula",
  date: () => new Date().toLocaleString("zh-CN"),
  neofetch: `
        ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿        space_explorer@galaxy
        ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿        ─────────────────────
        ⣿⣿⣿⣿⣿⣿⠟⠋⠉⠉⠉⠙⠻⣿⣿⣿⣿⣿⣿⣿⣿        OS: Galaxy Terminal v2.0
        ⣿⣿⣿⣿⡟⠁⠀⠀⠀⠀⠀⠀⠀⠈⢻⣿⣿⣿⣿⣿⣿        Host: Andromeda M31
        ⣿⣿⣿⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢿⣿⣿⣿⣿⣿        Kernel: quantum-6.0.0
        ⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣿⣿⣿        Uptime: ∞ light-years
        ⣿⣿⡇⠀⠀⠀⣀⣤⣤⣤⣤⣀⠀⠀⠀⠀⣿⣿⣿⣿⣿        Shell: cosmic-zsh
        ⣿⣿⡇⠀⠀⣾⣿⣿⣿⣿⣿⣿⣷⠀⠀⠀⣿⣿⣿⣿⣿        Resolution: 4K Nebula
        ⣿⣿⣿⠀⠀⠘⠿⣿⣿⣿⡿⠟⠃⠀⠀⠀⣿⣿⣿⣿⣿        Theme: Cosmic Dark
        ⣿⣿⣿⣧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣾⣿⣿⣿⣿⣿        Terminal: Galaxy Term
        ⣿⣿⣿⣿⣷⣄⠀⠀⠀⠀⠀⠀⣀⣴⣿⣿⣿⣿⣿⣿⣿        CPU: Quantum Core
        ⣿⣿⣿⣿⣿⣿⣿⣶⣶⣶⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿        Memory: ∞ PB
`,
  ls: `
📁 documents/    📁 projects/     📁 music/
📁 images/       📁 downloads/    📄 readme.md
📄 config.yaml   📄 .bashrc       📄 .gitconfig
`,
  stars: `
🌟 今日星座运势 🌟
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ 猎户座 - 冒险精神高涨
✨ 天鹅座 - 创造力爆发
✨ 仙女座 - 桃花运旺盛
✨ 大熊座 - 事业运上升
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`,
  matrix: "🔮 正在激活黑客帝国模式...",
  theme: "✨ 主题效果已切换！尝试不同的视觉体验。",
}

export function Terminal({ sessionName = "session_1" }: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 0, type: "system", content: WELCOME_MESSAGE, timestamp: new Date() },
  ])
  const [currentInput, setCurrentInput] = useState("")
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)
  const lineIdRef = useRef(1)

  const scrollToBottom = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [lines, scrollToBottom])

  const typeOutput = useCallback((content: string, type: TerminalLine["type"]) => {
    setIsTyping(true)
    const id = lineIdRef.current++
    let currentContent = ""
    let index = 0

    const typeChar = () => {
      if (index < content.length) {
        currentContent += content[index]
        setLines((prev) => {
          const existingIndex = prev.findIndex((l) => l.id === id)
          if (existingIndex >= 0) {
            const newLines = [...prev]
            newLines[existingIndex] = {
              ...newLines[existingIndex],
              content: currentContent,
            }
            return newLines
          }
          return [
            ...prev,
            { id, type, content: currentContent, timestamp: new Date() },
          ]
        })
        index++
        setTimeout(typeChar, Math.random() * 10 + 5)
      } else {
        setIsTyping(false)
      }
    }

    typeChar()
  }, [])

  const executeCommand = useCallback(
    (input: string) => {
      const trimmedInput = input.trim()
      const inputId = lineIdRef.current++

      // 添加输入行
      setLines((prev) => [
        ...prev,
        { id: inputId, type: "input", content: trimmedInput, timestamp: new Date() },
      ])

      if (trimmedInput) {
        setCommandHistory((prev) => [...prev, trimmedInput])
      }

      if (!trimmedInput) return

      const [command, ...args] = trimmedInput.toLowerCase().split(" ")

      if (command === "clear") {
        setLines([])
        return
      }

      if (command === "echo") {
        const outputId = lineIdRef.current++
        setLines((prev) => [
          ...prev,
          {
            id: outputId,
            type: "output",
            content: args.join(" ") || "",
            timestamp: new Date(),
          },
        ])
        return
      }

      if (command === "cat") {
        const filename = args[0]
        if (filename === "readme.md") {
          typeOutput(
            "# 银河终端\n\n欢迎使用银河终端！这是一个宇宙风格的终端模拟器。\n\n## 特性\n- 动态星空背景\n- 流星效果\n- 打字机动画\n- 命令历史",
            "output"
          )
        } else if (filename === "config.yaml") {
          typeOutput(
            "theme: cosmic\nanimations: true\nstarfield:\n  density: high\n  shooting_stars: enabled",
            "output"
          )
        } else {
          const outputId = lineIdRef.current++
          setLines((prev) => [
            ...prev,
            {
              id: outputId,
              type: "error",
              content: `cat: ${filename || "缺少文件名"}: 没有那个文件或目录`,
              timestamp: new Date(),
            },
          ])
        }
        return
      }

      const response = COMMANDS[command]
      if (response) {
        const output = typeof response === "function" ? response() : response
        typeOutput(output, command === "matrix" ? "success" : "output")
      } else {
        const outputId = lineIdRef.current++
        setLines((prev) => [
          ...prev,
          {
            id: outputId,
            type: "error",
            content: `命令未找到: ${command}。输入 'help' 查看可用命令。`,
            timestamp: new Date(),
          },
        ])
      }
    },
    [typeOutput]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isTyping) {
      executeCommand(currentInput)
      setCurrentInput("")
      setHistoryIndex(-1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex =
          historyIndex < commandHistory.length - 1
            ? historyIndex + 1
            : historyIndex
        setHistoryIndex(newIndex)
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || "")
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || "")
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setCurrentInput("")
      }
    } else if (e.key === "Tab") {
      e.preventDefault()
      // 简单的自动补全
      const commands = Object.keys(COMMANDS)
      const match = commands.find((cmd) =>
        cmd.startsWith(currentInput.toLowerCase())
      )
      if (match) {
        setCurrentInput(match)
      }
    }
  }

  const focusInput = () => {
    inputRef.current?.focus()
  }

  return (
    <div
      className="h-full flex flex-col bg-background/80 backdrop-blur-sm rounded-lg overflow-hidden border border-border/50"
      onClick={focusInput}
    >
      {/* 终端头部 */}
      <div className="flex items-center gap-2 px-4 py-2 bg-card/50 border-b border-border/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-sm text-muted-foreground font-mono ml-2">
          {sessionName} — cosmic-zsh
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="animate-pulse">●</span>
          <span>已连接</span>
        </div>
      </div>

      {/* 终端内容 */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border"
      >
        {lines.map((line) => (
          <div
            key={line.id}
            className={cn(
              "whitespace-pre-wrap",
              line.type === "input" && "flex items-start gap-2",
              line.type === "error" && "text-red-400",
              line.type === "success" && "text-green-400",
              line.type === "system" && "text-primary terminal-text"
            )}
          >
            {line.type === "input" ? (
              <>
                <span className="text-primary shrink-0">
                  <span className="text-green-400">➜</span>{" "}
                  <span className="text-primary">~/cosmos</span>
                </span>
                <span className="text-foreground">{line.content}</span>
              </>
            ) : (
              <span>{line.content}</span>
            )}
          </div>
        ))}

        {/* 当前输入行 */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-primary shrink-0">
            <span className="text-green-400">➜</span>{" "}
            <span className="text-primary">~/cosmos</span>
          </span>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent outline-none text-foreground caret-transparent"
              autoFocus
              disabled={isTyping}
            />
            {/* 自定义光标 */}
            <span
              className="absolute top-0 pointer-events-none text-foreground"
              style={{ left: `${currentInput.length}ch` }}
            >
              <span className="animate-cursor-blink inline-block w-2 h-5 bg-primary" />
            </span>
          </div>
        </div>
      </div>

      {/* 状态栏 */}
      <div className="px-4 py-1.5 bg-card/30 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground font-mono">
        <div className="flex items-center gap-4">
          <span>行: {lines.length}</span>
          <span>历史: {commandHistory.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-green-400">●</span>
          <span>UTF-8</span>
          <span>|</span>
          <span>zsh</span>
        </div>
      </div>
    </div>
  )
}
