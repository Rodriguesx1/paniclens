import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FilePlus2, FolderOpen, Users, Cpu, LogOut, Sparkles, BookOpen } from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar, SidebarHeader, SidebarFooter,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

const items = [
  { title: 'Dashboard', url: '/app', icon: LayoutDashboard, end: true },
  { title: 'Nova análise', url: '/app/new', icon: FilePlus2 },
  { title: 'Casos', url: '/app/cases', icon: FolderOpen },
  { title: 'Clientes', url: '/app/customers', icon: Users },
  { title: 'Base de conhecimento', url: '/app/knowledge', icon: BookOpen },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut, user } = useAuth();
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-[var(--shadow-gold)]">
            <Cpu className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">PanicLens</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">iOS panic intelligence</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Bancada</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url || (!item.end && location.pathname.startsWith(item.url))}>
                    <NavLink to={item.url} end={item.end}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="mb-2 px-1 text-xs text-muted-foreground truncate">{user?.email}</div>
        )}
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sair</span>}
        </Button>
        {!collapsed && (
          <div className="mt-2 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Engine v1.0.0
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
