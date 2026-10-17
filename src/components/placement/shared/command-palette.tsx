'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAppStore, roleHomeView } from '@/store/app-store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, CornerDownLeft, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuthUser, Role } from '@/types'

interface CommandItem {
  view: string
  label: string
  group: string
  keywords?: string
  icon?: React.ComponentType<{ className?: string }>
}

interface Props {
  navItems: Array<{ view: string; label: string; icon: React.ComponentType<{ className?: string }>; group?: string }>
}

/**
 * Global Command Palette — opens with Cmd+K (or Ctrl+K).
 * Lets users search and jump to any nav destination quickly.
 * Mounted once per role-app root.
 */
export function CommandPalette({ navItems }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const user = useAppStore(s => s.user) as AuthUser | null
  const navigate = useAppStore(s => s.navigate)

  // Build command list with sensible groups + extra quick actions
  const commands: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = navItems.map(n => ({
      view: n.view,
      label: n.label,
      group: n.group ?? 'Navigation',
      icon: n.icon,
      keywords: n.label.toLowerCase(),
    }))
    // Add a "Go home" quick action
    if (user) {
      items.unshift({
        view: roleHomeView(user.role),
        label: 'Go to dashboard',
        group: 'Quick actions',
        keywords: 'home dashboard overview',
      })
    }
    return items
  }, [navItems, user])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.group.toLowerCase().includes(q) ||
      c.keywords?.includes(q)
    )
  }, [query, commands])

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Reset query + active index on close
  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  // Clamp active index when filtered list changes
  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0)
  }, [filtered.length, activeIndex])

  // Group filtered results
  const grouped = useMemo(() => {
    const groups = new Map<string, CommandItem[]>()
    for (const c of filtered) {
      if (!groups.has(c.group)) groups.set(c.group, [])
      groups.get(c.group)!.push(c)
    }
    return Array.from(groups.entries())
  }, [filtered])

  const runCommand = (cmd: CommandItem) => {
    navigate(cmd.view)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[activeIndex]
      if (cmd) runCommand(cmd)
    }
  }

  // Build flat indexed list for keyboard nav
  let flatIndex = -1

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 max-w-xl overflow-hidden" onKeyDown={onKeyDown}>
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>Search and jump to any section.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 px-3 border-b">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, actions…"
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-11"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>
        <ScrollArea className="max-h-80 scroll-area-thin">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No matches for "{query}"
            </div>
          ) : (
            <div className="p-1">
              {grouped.map(([groupName, items]) => (
                <div key={groupName} className="mb-1">
                  <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                    {groupName}
                  </div>
                  {items.map((cmd) => {
                    flatIndex++
                    const isActive = flatIndex === activeIndex
                    const Icon = cmd.icon
                    return (
                      <button
                        key={cmd.view + flatIndex}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        onClick={() => runCommand(cmd)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-left transition-colors',
                          isActive ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/60'
                        )}
                      >
                        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
                        <span className="flex-1 truncate">{cmd.label}</span>
                        {isActive && <CornerDownLeft className="size-3 text-muted-foreground" />}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="border-t px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="inline-flex items-center gap-0.5 rounded border bg-muted px-1 py-0.5 font-mono">↑</kbd>
            <kbd className="inline-flex items-center gap-0.5 rounded border bg-muted px-1 py-0.5 font-mono">↓</kbd>
            <span>to navigate</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Press</span>
            <kbd className="inline-flex items-center gap-0.5 rounded border bg-muted px-1 py-0.5 font-mono">Enter</kbd>
            <span>to select</span>
            <ArrowRight className="size-3 ml-1" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
