import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

export default function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-card/50 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <SidebarTrigger />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">PanicLens workspace</div>
                  <div className="truncate text-xs text-muted-foreground">
                    Diagnóstico, histórico e billing com persistência real
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1600px] flex-1 p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
