import { Switch, Route, Router } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from './components/ThemeProvider';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/Dashboard';
import BotsPage from './pages/Bots';
import BotDetailPage from './pages/BotDetail';
import LogsPage from './pages/Logs';
import ErrorLogsPage from './pages/ErrorLogs';
import OperationsPage from './pages/Operations';
import NotFound from './pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 15_000, // auto-refresh every 15s
      staleTime: 10_000,
      retry: 2,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router hook={useHashLocation}>
          <div className="flex h-screen bg-background text-foreground overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              <Switch>
                <Route path="/" component={DashboardPage} />
                <Route path="/bots" component={BotsPage} />
                <Route path="/bots/:id" component={BotDetailPage} />
                <Route path="/logs" component={LogsPage} />
                <Route path="/errors" component={ErrorLogsPage} />
                <Route path="/operations" component={OperationsPage} />
                <Route component={NotFound} />
              </Switch>
            </main>
          </div>
        </Router>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
