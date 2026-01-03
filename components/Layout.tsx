'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

const SidebarItem = ({ icon: Icon, label, href, active = false }: { icon: any, label: string, href: string, active?: boolean }) => (
  <Link
    href={href}
    className={cn(
      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
      active 
        ? "bg-primary/10 text-primary" 
        : "text-slate-400 hover:bg-surface hover:text-slate-100"
    )}
  >
    <Icon className="h-4 w-4" />
    {label}
  </Link>
);

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const pathname = usePathname();

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <div className="min-h-screen bg-background text-text flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-800 bg-background/50 backdrop-blur-xl fixed inset-y-0 left-0 z-50">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Vinted<span className="text-primary">Cron</span></span>
          </Link>
        </div>

        <div className="flex-1 px-4 py-2 space-y-1">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              active={pathname === item.href}
            />
          ))}
        </div>

      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-slate-800 bg-background z-50 flex items-center justify-between px-4">
        <Link href="/" className="font-bold">VintedCron</Link>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
          className="p-2 text-slate-400 hover:text-slate-100 transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 pt-16">
          <div className="bg-background border-r border-slate-800 h-full w-64 shadow-xl">
            <div className="p-4 space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    pathname === item.href
                      ? "bg-primary/10 text-primary" 
                      : "text-slate-400 hover:bg-surface hover:text-slate-100"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-black/50 -z-10"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-200 ease-in-out p-6 md:p-8 pt-20 md:pt-8 md:ml-64",
        isMobileMenuOpen ? "md:opacity-100 md:pointer-events-auto" : ""
      )}>
        <div className="max-w-7xl mx-auto space-y-8">
          {children}
        </div>
      </main>
    </div>
  );
};
