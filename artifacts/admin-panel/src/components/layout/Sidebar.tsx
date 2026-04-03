import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Inbox,
  Send,
  MessageSquareText,
  ShieldAlert,
  Settings,
  LineChart,
  Bot,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/requests", label: "Join Requests", icon: Inbox },
    { href: "/users", label: "Users", icon: Users },
    { href: "/broadcasts", label: "Broadcasts", icon: Send },
    { href: "/welcome", label: "Welcome Messages", icon: MessageSquareText },
    { href: "/messages", label: "Response Messages", icon: MessageCircle },
    { href: "/admins", label: "Admin Panel", icon: ShieldAlert },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/analytics", label: "Analytics", icon: LineChart },
    { href: "/auto-rules", label: "Auto Rules", icon: Bot },
  ];

  return (
    <div className="w-64 bg-card border-r border-border h-full flex flex-col text-card-foreground">
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-bold text-primary flex items-center gap-2">
          <Bot className="w-6 h-6" />
          Mission Control
        </h2>
        <p className="text-xs text-muted-foreground mt-1">True Request Acceptor</p>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="px-3 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
