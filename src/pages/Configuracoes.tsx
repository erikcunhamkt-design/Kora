import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Configuracoes = () => (
  <div className="max-w-2xl space-y-8">
    <div className="orbit-card p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">Perfil</h3>
      <div className="flex items-center gap-4 mb-6">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="orbit-gradient text-white text-lg font-bold">DS</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-foreground">Designer Studio</p>
          <p className="text-sm text-muted-foreground">designer@studio.com</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">Nome</Label>
          <Input defaultValue="Designer Studio" className="bg-muted border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">Email</Label>
          <Input defaultValue="designer@studio.com" className="bg-muted border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">Telefone</Label>
          <Input defaultValue="(11) 99999-0000" className="bg-muted border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">Website</Label>
          <Input defaultValue="www.designerstudio.com" className="bg-muted border-border" />
        </div>
      </div>
      <Button className="mt-4 orbit-gradient text-white border-0">Salvar Alterações</Button>
    </div>

    <div className="orbit-card p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">Notificações</h3>
      <div className="space-y-4">
        {["Novos clientes", "Tarefas atrasadas", "Pagamentos recebidos", "Metas atingidas"].map((item) => (
          <div key={item} className="flex items-center justify-between">
            <span className="text-sm text-foreground">{item}</span>
            <Switch defaultChecked />
          </div>
        ))}
      </div>
    </div>

    <div className="orbit-card p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">Aparência</h3>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-foreground">Modo Escuro</span>
          <p className="text-xs text-muted-foreground">Ativado por padrão</p>
        </div>
        <Switch defaultChecked />
      </div>
    </div>
  </div>
);

export default Configuracoes;
