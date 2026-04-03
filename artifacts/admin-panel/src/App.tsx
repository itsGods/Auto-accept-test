import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Requests from "@/pages/requests";
import Users from "@/pages/users";
import Broadcasts from "@/pages/broadcasts";
import Welcome from "@/pages/welcome";
import Messages from "@/pages/messages";
import Admins from "@/pages/admins";
import Settings from "@/pages/settings";
import Analytics from "@/pages/analytics";
import AutoRules from "@/pages/auto-rules";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

if (typeof document !== "undefined") {
  document.documentElement.classList.add("dark");
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/requests" component={Requests} />
        <Route path="/users" component={Users} />
        <Route path="/broadcasts" component={Broadcasts} />
        <Route path="/welcome" component={Welcome} />
        <Route path="/messages" component={Messages} />
        <Route path="/admins" component={Admins} />
        <Route path="/settings" component={Settings} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/auto-rules" component={AutoRules} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
