import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";

import Dashboard from "@/pages/Dashboard";
import Campaigns from "@/pages/Campaigns";
import CreateCampaign from "@/pages/CreateCampaign";
import CampaignDetail from "@/pages/CampaignDetail";
import ResponsivePreview from "@/pages/ResponsivePreview";
import Settings from "@/pages/Settings";
import Recipients from "@/pages/Recipients";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    }
  }
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/recipients" component={Recipients} />
        <Route path="/campaigns" component={Campaigns} />
        <Route path="/campaigns/new" component={CreateCampaign} />
        <Route path="/campaigns/:id/preview" component={ResponsivePreview} />
        <Route path="/campaigns/:id" component={CampaignDetail} />
        <Route path="/settings" component={Settings} />
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
