'use client'

import { useState } from 'react'
import { useAppStore, roleHomeView } from '@/store/app-store'
import { useLogout, useNotifications, useMarkAllNotificationsRead } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Bell, LogOut, Menu, Check, ChevronRight, User, Settings as SettingsIcon, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from './ui'
import { CommandPalette } from './command-palette'
import type { Role } from '@/types'

export interface NavItem {
  view: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
  /** Group label for nav organization (e.g., "Plan", "Build", "Track"). Optional. */
  group?: string
}

export function AppShell({
  navItems,
  children,
}: {
  navItems: NavItem[]
  children: React.ReactNode
}) {
  const { user, route, navigate, sidebarOpen, setSidebarOpen } = useAppStore()
  const logout = useLogout()
  const notifQuery = useNotifications()
  const markAllRead = useMarkAllNotificationsRead()
  const [notifOpen, setNotifOpen] = useState(false)

  if (!user) return null

  const unreadCount = notifQuery.data?.filter(n => !n.read)?.length ?? 0
  const roleLabel: Record<Role, string> = {
    STUDENT: 'Student', OFFICER: 'Placement Officer', RECRUITER: 'Recruiter', ADMIN: 'Administrator',
  }

  // Group nav items by their "group" field, preserving order
  const groups: { label?: string; items: NavItem[] }[] = []
  for (const item of navItems) {
    const g = item.group
    const last = groups[groups.length - 1]
    if (last && last.label === g) last.items.push(item)
    else groups.push({ label: g, items: [item] })
  }

  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const SidebarContent = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <button
          className="flex items-center gap-2.5 w-full group"
          onClick={() => navigate(roleHomeView(user.role))}
          aria-label="Go to dashboard"
        >
          <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm group-hover:shadow transition-shadow">
            PH
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-semibold leading-tight text-sidebar-foreground">Skillproof</div>
            <div className="text-xs text-muted-foreground mt-0.5">{roleLabel[user.role]}</div>
          </div>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 scroll-area-thin" aria-label="Primary">
        {groups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
            {group.label && (
              <div className="px-2 mb-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map(item => {
                const Icon = item.icon
                const active = route.view === item.view || route.view.startsWith(item.view + '/')
                return (
                  <li key={item.view}>
                    <button
                      onClick={() => navigate(item.view)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                      )}
                    >
                      <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {item.badge ? (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1 tabular-nums">{item.badge > 99 ? '99+' : item.badge}</Badge>
                      ) : null}
                      {active && <ChevronRight className="size-3 text-muted-foreground" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Profile footer */}
      <div className="px-2 py-3 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-sidebar-accent/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs font-medium truncate text-sidebar-foreground">{user.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate(roleHomeView(user.role))}>
              <User className="size-4 mr-2" /> Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(getSettingsView(user.role))}>
              <SettingsIcon className="size-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout.mutate()} className="text-destructive focus:text-destructive">
              <LogOut className="size-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Command palette (Cmd+K) */}
      <CommandPalette navItems={navItems} />

      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Mobile menu */}
          <div className="flex items-center gap-2">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden -ml-2 size-9" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                {SidebarContent}
              </SheetContent>
            </Sheet>
            {/* Breadcrumb-style page indicator on mobile */}
            <div className="md:hidden">
              <div className="text-sm font-medium truncate max-w-[60vw]">
                {navItems.find(n => route.view === n.view || route.view.startsWith(n.view + '/'))?.label ?? 'Skillproof'}
              </div>
            </div>
          </div>

          {/* Search trigger (desktop) — opens command palette */}
          <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
            <button
              onClick={() => {
                // Simulate Cmd+K by dispatching the event
                const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
                window.dispatchEvent(ev)
              }}
              className="w-full flex items-center gap-2 px-3 h-9 rounded-md border bg-muted/40 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open command palette"
            >
              <Search className="size-4" />
              <span className="flex-1 text-left">Search or jump to…</span>
              <kbd className="inline-flex items-center gap-0.5 rounded border bg-card px-1 py-0.5 text-[10px] font-mono">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex-1 md:hidden" />

          <div className="flex items-center gap-1">
            {/* Mobile search button — opens command palette */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden size-9"
              aria-label="Search"
              onClick={() => {
                const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
                window.dispatchEvent(ev)
              }}
            >
              <Search className="size-4" />
            </Button>
            {/* Notifications */}
            <Popover open={notifOpen} onOpenChange={setNotifOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative size-9" aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}>
                  <Bell className="size-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between p-3 border-b">
                  <span className="text-sm font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => markAllRead.mutate()}
                      disabled={markAllRead.isPending}
                    >
                      <Check className="size-3 mr-1" /> Mark all read
                    </Button>
                  )}
                </div>
                <ScrollArea className="max-h-80 scroll-area-thin">
                  <div className="divide-y">
                    {notifQuery.isLoading && (
                      <div className="p-4 text-sm text-muted-foreground">Loading…</div>
                    )}
                    {notifQuery.data?.length === 0 && (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        <Bell className="size-5 mx-auto mb-2 opacity-40" />
                        No notifications yet.
                      </div>
                    )}
                    {notifQuery.data?.map(n => (
                      <button
                        key={n.id}
                        className={cn(
                          'w-full text-left p-3 hover:bg-muted/50 transition-colors',
                          !n.read && 'bg-primary/[0.03]'
                        )}
                        onClick={() => {
                          if (n.link) navigate(n.link)
                          setNotifOpen(false)
                        }}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && <span className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                          <div className={cn('flex-1 min-w-0', n.read && 'pl-4')}>
                            <div className="text-sm font-medium text-foreground">{n.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
                            <div className="text-[10px] text-muted-foreground/80 mt-1">
                              {formatRelativeTime(n.createdAt)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* User avatar (desktop) */}
            <div className="hidden md:flex items-center gap-2 pl-2 ml-1 border-l">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="text-sm leading-tight">
                <div className="font-medium text-foreground max-w-[140px] truncate">{user.name}</div>
                <div className="text-[10px] text-muted-foreground">{roleLabel[user.role]}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="flex-1 flex">
        <aside className="hidden md:block w-60 border-r bg-sidebar sticky top-14 self-start h-[calc(100vh-3.5rem-2.5rem)] overflow-y-auto">
          {SidebarContent}
        </aside>
        <main className="flex-1 min-w-0">
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Sticky footer */}
      <footer className="border-t bg-card py-3 mt-auto">
        <div className="container mx-auto px-6 text-center text-xs text-muted-foreground">
          Skillproof · Evidence-based placements · Algorithm v1.0 ·{' '}
          <span className="text-[var(--pending-foreground)]">Demo data — do not use for real recruitment</span>
        </div>
      </footer>
    </div>
  )
}

function getSettingsView(role: Role): string {
  if (role === 'STUDENT') return 'student/settings'
  if (role === 'OFFICER') return 'officer/settings'
  if (role === 'RECRUITER') return 'recruiter/settings'
  return 'officer/settings'
}
