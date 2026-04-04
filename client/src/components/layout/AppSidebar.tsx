import {
  LayoutDashboard,
  Search,
  Map,
  MessageSquare,
  Package,
  Compass,
  Zap,
  Bug,
  FileText,
  Settings,
  Code2,
  Crown,
  Lock,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Analyze", url: "/analyze", icon: Search },
  { title: "Repository Map", url: "/map", icon: Map },
  { title: "AI Chat", url: "/chat", icon: MessageSquare },
];

const analysisItems = [
  { title: "Dependencies", url: "/dependencies", icon: Package },
  { title: "Bug Detector", url: "/bugs", icon: Bug },
  { title: "Codebase Tour", url: "/tour", icon: Compass, premium: true },
  { title: "Impact Analysis", url: "/impact", icon: Zap, premium: true },
];

const otherItems = [
  { title: "Documentation", url: "/docs", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Subscription", url: "/subscription", icon: Crown },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { user } = useAuth();
  const isSubscribed = Boolean(user?.isSubscribed);

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const renderItems = (items: typeof mainItems) =>
    items.map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end
            onClick={closeMobileSidebar}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5"
            activeClassName="bg-sidebar-accent text-primary font-medium shadow-sm"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="text-sm">{item.title}</span>}
            {!collapsed && "premium" in item && item.premium && !isSubscribed && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                <Lock className="h-3 w-3" />
                Pro
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon" className="border-r border-border/80">
      <SidebarHeader className="px-4 py-5">
        <NavLink to="/" onClick={closeMobileSidebar} className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
            <Code2 className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-foreground text-sm tracking-tight">
              AI CodeNav
            </span>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup className="py-1.5">
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
            {!collapsed && "Main"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(mainItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="py-1.5">
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
            {!collapsed && "Analysis"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(analysisItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="py-1.5">
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
            {!collapsed && "Other"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(otherItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t border-border">
        {!collapsed && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-mono">v1.0.0</p>
            {!isSubscribed && (
              <NavLink
                to="/subscription"
                onClick={closeMobileSidebar}
                className="flex items-center gap-2 rounded-lg border border-border/70 bg-secondary/60 px-3 py-2 text-xs text-foreground hover:bg-secondary"
              >
                <Crown className="h-3.5 w-3.5 text-amber-500" />
                Unlock Pro features
              </NavLink>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
