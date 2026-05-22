import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlanProvider } from "@/contexts/PlanContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
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
import Upgrade from "./pages/Upgrade";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Landing from "./pages/Landing";
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
            <PaywallModal />
            <Routes>
              {/* Public routes */}
              <Route path="/landing" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected routes */}
              <Route path="/" element={<ProtectedRoute><MainLayout><Index /></MainLayout></ProtectedRoute>} />
              <Route path="/portfolio" element={<ProtectedRoute><MainLayout><Portfolio /></MainLayout></ProtectedRoute>} />
              <Route path="/clientes" element={<ProtectedRoute><MainLayout><Clientes /></MainLayout></ProtectedRoute>} />
              <Route path="/crm" element={<ProtectedRoute><MainLayout><CRM /></MainLayout></ProtectedRoute>} />
              <Route path="/vendas" element={<ProtectedRoute><MainLayout><Vendas /></MainLayout></ProtectedRoute>} />
              <Route path="/financeiro" element={<ProtectedRoute><MainLayout><Financeiro /></MainLayout></ProtectedRoute>} />
              <Route path="/tarefas" element={<ProtectedRoute><MainLayout><Tarefas /></MainLayout></ProtectedRoute>} />
              <Route path="/metas" element={<ProtectedRoute><MainLayout><Metas /></MainLayout></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><MainLayout><Configuracoes /></MainLayout></ProtectedRoute>} />
              <Route path="/upgrade" element={<ProtectedRoute><MainLayout><Upgrade /></MainLayout></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </PlanProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
