'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { useLogout, useNotifications, useMarkAllNotificationsRead } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Bell, LogOut, Menu, Check, X, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import type { Role } from '@/types'

export interface NavItem {
  view: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
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

  const SidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <button
          className="flex items-center gap-2 w-full"
          onClick={() => navigate(roleHomeViewSafe(user.role))}
        >
          <div className="size-8 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center font-bold text-sm">
            PH
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-semibold leading-tight">Placement Hub</div>
            <div className="text-xs text-slate-500">{roleLabel[user.role]}</div>
          </div>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon
          const active = route.view === item.view || route.view.startsWith(item.view + '/')
          return (
            <button
              key={item.view}
              onClick={() => navigate(item.view)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">{item.badge}</Badge>
              ) : null}
              {active && <ChevronRight className="size-3" />}
            </button>
          )
        })}
      </nav>
      <div className="p-3 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-700 dark:text-slate-300"
          onClick={() => logout.mutate()}
        >
          <LogOut className="size-4 mr-2" /> Sign out
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b bg-white dark:bg-slate-950">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Mobile menu */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="md:hidden -ml-2">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              {SidebarContent}
            </SheetContent>
          </Sheet>

          <div className="flex-1 flex items-center justify-end gap-2">
            {/* Notifications */}
            <Popover open={notifOpen} onOpenChange={setNotifOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="relative">
                  <Bell className="size-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
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
                <ScrollArea className="max-h-80">
                  <div className="divide-y">
                    {notifQuery.isLoading && (
                      <div className="p-4 text-sm text-slate-500">Loading…</div>
                    )}
                    {notifQuery.data?.length === 0 && (
                      <div className="p-6 text-center text-sm text-slate-500">
                        <Bell className="size-6 mx-auto mb-2 opacity-50" />
                        No notifications yet.
                      </div>
                    )}
                    {notifQuery.data?.map(n => (
                      <div
                        key={n.id}
                        className={cn('p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900', !n.read && 'bg-blue-50/50 dark:bg-blue-950/30')}
                        onClick={() => {
                          if (n.link) navigate(n.link)
                          setNotifOpen(false)
                        }}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && <span className="size-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{n.title}</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{n.message}</div>
                            <div className="text-xs text-slate-400 mt-1">
                              {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* User avatar */}
            <div className="flex items-center gap-2 pl-2 border-l">
              <div className="size-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-300 dark:to-slate-100 text-white dark:text-slate-900 flex items-center justify-center text-xs font-semibold">
                {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden md:block text-sm">
                <div className="font-medium leading-tight">{user.name}</div>
                <div className="text-xs text-slate-500">{roleLabel[user.role]}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="flex-1 flex">
        <aside className="hidden md:block w-64 border-r bg-white dark:bg-slate-950 sticky top-14 self-start h-[calc(100vh-3.5rem-3.5rem)] overflow-y-auto">
          {SidebarContent}
        </aside>
        <main className="flex-1 min-w-0 p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-slate-950 py-3">
        <div className="container mx-auto px-6 text-center text-xs text-slate-500">
          Placement Hub · Evidence-based placements · Algorithm v1.0 ·{' '}
          <span className="text-amber-600">Demo data — do not use for real recruitment</span>
        </div>
      </footer>
    </div>
  )
}

function roleHomeViewSafe(role: Role): string {
  switch (role) {
    case 'STUDENT': return 'student/dashboard'
    case 'OFFICER': return 'officer/dashboard'
    case 'RECRUITER': return 'recruiter/dashboard'
    case 'ADMIN': return 'officer/dashboard'
    default: return 'landing'
  }
}

export { X }
