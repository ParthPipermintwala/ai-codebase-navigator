import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AuthGate } from "@/components/auth/AuthGate";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Analyze from "./pages/Analyze";
import Repository from "./pages/Repository";
import RepoMap from "./pages/RepoMap";
import Chat from "./pages/Chat";
import Dependencies from "./pages/Dependencies";
import Tour from "./pages/Tour";
import Impact from "./pages/Impact";
import Docs from "./pages/Docs";
import SettingsPage from "./pages/SettingsPage";
import Subscription from "./pages/Subscription";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import Login from "./pages/Login";
import CreateAccount from "./pages/CreateAccount";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <AuthGate>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<CreateAccount />} />
                <Route path="/create-account" element={<CreateAccount />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route
                  path="/pricing"
                  element={
                    <ProtectedRoute>
                      <Subscription />
                    </ProtectedRoute>
                  }
                />

                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/analyze" element={<Analyze />} />
                  <Route path="/repository/:repoId" element={<Repository />} />
                  <Route path="/map" element={<RepoMap />} />
                  <Route
                    path="/chat"
                    element={
                      <ProtectedRoute>
                        <Chat />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/dependencies" element={<Dependencies />} />
                  <Route
                    path="/subscription"
                    element={
                      <ProtectedRoute>
                        <Subscription />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/subscription/success"
                    element={
                      <ProtectedRoute>
                        <SubscriptionSuccess />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/success"
                    element={
                      <ProtectedRoute>
                        <SubscriptionSuccess />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/tour"
                    element={
                      <ProtectedRoute requiresSubscription>
                        <Tour />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/impact"
                    element={
                      <ProtectedRoute requiresSubscription>
                        <Impact />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/docs" element={<Docs />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </AuthGate>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
