import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlanProvider } from "@/contexts/PlanContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { PaywallModal } from "@/components/plan/PaywallModal";
import { MainLayout } from "@/components/layout/MainLayout";
import Index from "./pages/Index";
import Portfolio from "./pages/Portfolio";
import Clientes from "./pages/Clientes";
import CRM from "./pages/CRM";
import Financeiro from "./pages/Financeiro";
import Tarefas from "./pages/Tarefas";
import Metas from "./pages/Metas";
import Configuracoes from "./pages/Configuracoes";
import Vendas from "./pages/Vendas";
import Automacoes from "./pages/Automacoes";
import Presenca from "./pages/Presenca";
import PublicProfilePage from "./pages/PublicProfile";
import Upgrade from "./pages/Upgrade";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PlanProvider>
            <OnboardingProvider>
              <PaywallModal />
              <Routes>
                {/* Public routes */}
                <Route path="/landing" element={<Landing />} />
                <Route path="/publico/:slug" element={<PublicProfilePage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Onboarding (gated by completion check inside) */}
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

                {/* Protected routes */}
                <Route path="/" element={<ProtectedRoute><OnboardingGate><MainLayout><Index /></MainLayout></OnboardingGate></ProtectedRoute>} />
                <Route path="/portfolio" element={<ProtectedRoute><OnboardingGate><MainLayout><Portfolio /></MainLayout></OnboardingGate></ProtectedRoute>} />
                <Route path="/clientes" element={<ProtectedRoute><OnboardingGate><MainLayout><Clientes /></MainLayout></OnboardingGate></ProtectedRoute>} />
                <Route path="/crm" element={<ProtectedRoute><OnboardingGate><MainLayout><CRM /></MainLayout></OnboardingGate></ProtectedRoute>} />
                <Route path="/vendas" element={<ProtectedRoute><OnboardingGate><MainLayout><Vendas /></MainLayout></OnboardingGate></ProtectedRoute>} />
                <Route path="/financeiro" element={<ProtectedRoute><OnboardingGate><MainLayout><Financeiro /></MainLayout></OnboardingGate></ProtectedRoute>} />
                <Route path="/tarefas" element={<ProtectedRoute><OnboardingGate><MainLayout><Tarefas /></MainLayout></OnboardingGate></ProtectedRoute>} />
                <Route path="/metas" element={<ProtectedRoute><OnboardingGate><MainLayout><Metas /></MainLayout></OnboardingGate></ProtectedRoute>} />
                <Route path="/automacoes" element={<ProtectedRoute><OnboardingGate><MainLayout><Automacoes /></MainLayout></OnboardingGate></ProtectedRoute>} />
                <Route path="/presenca" element={<ProtectedRoute><OnboardingGate><MainLayout><Presenca /></MainLayout></OnboardingGate></ProtectedRoute>} />
                <Route path="/configuracoes" element={<ProtectedRoute><OnboardingGate><MainLayout><Configuracoes /></MainLayout></OnboardingGate></ProtectedRoute>} />
                <Route path="/upgrade" element={<ProtectedRoute><OnboardingGate><MainLayout><Upgrade /></MainLayout></OnboardingGate></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </OnboardingProvider>
          </PlanProvider>
        </AuthProvider>
      </BrowserRouter>

    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
