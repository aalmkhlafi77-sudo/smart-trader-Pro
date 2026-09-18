import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import AccessGate from "./components/AccessGate";
import FloatingCalculator from "./components/FloatingCalculator";
import { AccessProvider } from "./contexts/AccessContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { LoginBackgroundProvider } from "./contexts/LoginBackgroundContext";
import { WorkspacePreferencesProvider } from "./contexts/WorkspacePreferencesContext";
import { ActivityThemeProvider } from "./contexts/ActivityThemeContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Entities from "./pages/Entities";
import Items from "./pages/Items";
import Prices from "./pages/Prices";
import Pricing from "./pages/Pricing";
import Runs from "./pages/cargo/Runs";
import ExportLists from "./pages/ExportLists";
import Backup from "./pages/Backup";
import SettingsIndex from "./pages/settings/Index";
import SettingsBusiness from "./pages/settings/Business";
import SettingsFinancial from "./pages/settings/Financial";
import SettingsCatalog from "./pages/settings/Catalog";
import SettingsLogistics from "./pages/settings/Logistics";
import SettingsWorkspace from "./pages/settings/Workspace";
import SettingsSecurity from "./pages/settings/Security";
import SettingsData from "./pages/settings/Data";
import Reports from "./pages/Reports";
import FollowUp from "./pages/FollowUp";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/entities" component={Entities} />
      <Route path="/items" component={Items} />
      <Route path="/prices" component={Prices} />
      <Route path="/cargo" component={Pricing} />
      <Route path="/cargo/runs" component={Runs} />
      <Route path="/pricing">
        <Redirect to="/cargo" />
      </Route>
      <Route path="/reports" component={Reports} />
      <Route path="/follow-up" component={FollowUp} />
      <Route path="/export" component={ExportLists} />
      <Route path="/backup" component={Backup} />
      <Route path="/settings" component={SettingsIndex} />
      <Route path="/settings/business" component={SettingsBusiness} />
      <Route path="/settings/financial" component={SettingsFinancial} />
      <Route path="/settings/catalog" component={SettingsCatalog} />
      <Route path="/settings/logistics" component={SettingsLogistics} />
      <Route path="/settings/workspace" component={SettingsWorkspace} />
      <Route path="/settings/security" component={SettingsSecurity} />
      <Route path="/settings/data" component={SettingsData} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <LanguageProvider>
          <ActivityThemeProvider>
            <WorkspacePreferencesProvider>
              <LoginBackgroundProvider>
                <AccessProvider>
                  <TooltipProvider>
                    <Toaster />
                    <AccessGate>
                      <Router />
                      <FloatingCalculator />
                    </AccessGate>
                  </TooltipProvider>
                </AccessProvider>
              </LoginBackgroundProvider>
            </WorkspacePreferencesProvider>
          </ActivityThemeProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
