import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  
  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
      <div className="flex min-h-screen w-full bg-muted/20">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden relative">
          {/* Decorative background blur */}
          <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none -z-10" />
          
          <header className="h-16 flex items-center px-4 md:px-8 border-b bg-background/80 backdrop-blur-md sticky top-0 z-40 supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
            <div className="ml-auto flex items-center gap-4">
               {/* User avatar placeholder */}
               <div className="w-8 h-8 rounded-full bg-secondary border flex items-center justify-center text-xs font-medium text-secondary-foreground">
                 ME
               </div>
            </div>
          </header>
          <div className="flex-1 overflow-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="p-4 md:p-8 max-w-7xl mx-auto w-full h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
