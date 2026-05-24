import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, Orbit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { translateAuthError } from "@/lib/password";


export default function Login() {
  const { signIn, user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao entrar", description: translateAuthError(error.message), variant: "destructive" });
    }

  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background atmosphere */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/[0.06] blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-accent/[0.04] blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 animate-fade-up relative z-10">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2.5">
            <div className="h-11 w-11 rounded-xl orbit-gradient flex items-center justify-center shadow-[0_0_24px_hsl(263_84%_58%/0.3)]">
              <Orbit className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold orbit-gradient-text">Orbit</span>
          </div>
          <p className="text-muted-foreground text-[0.9375rem]">Gerencie seu negócio criativo</p>
        </div>

        <div className="orbit-card-glass p-8 space-y-6">
          <div className="text-center space-y-1.5">
            <h2 className="text-xl font-semibold text-foreground">Entrar na sua conta</h2>
            <p className="text-[0.875rem] text-muted-foreground">Insira suas credenciais para acessar o painel</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link to="/forgot-password" className="text-[0.8125rem] text-primary hover:underline font-medium">
                  Esqueci minha senha
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full orbit-gradient border-0" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Entrar
            </Button>
          </form>

          <p className="text-center text-[0.875rem] text-muted-foreground">
            Não tem conta?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
