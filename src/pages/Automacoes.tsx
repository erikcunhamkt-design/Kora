import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AISection } from "@/components/automacoes/AISection";
import { WhatsAppSection } from "@/components/automacoes/WhatsAppSection";
import { AutomationsSection } from "@/components/automacoes/AutomationsSection";
import { IntegrationsSection } from "@/components/automacoes/IntegrationsSection";
import { CampaignsSection } from "@/components/campaigns/CampaignsSection";

export default function Automacoes() {
  return (
    <div>
      <PageHeader title="Automações & IA" subtitle="Assistentes, WhatsApp, regras automáticas, campanhas e integrações" />
      <Tabs defaultValue="ia" className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="ia">IA</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
        </TabsList>
        <TabsContent value="ia"><AISection /></TabsContent>
        <TabsContent value="whatsapp"><WhatsAppSection /></TabsContent>
        <TabsContent value="automacoes"><AutomationsSection /></TabsContent>
        <TabsContent value="campanhas"><CampaignsSection /></TabsContent>
        <TabsContent value="integracoes"><IntegrationsSection /></TabsContent>
      </Tabs>
    </div>
  );
}
