import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AISection } from "@/components/automacoes/AISection";
import { AutomationsSection } from "@/components/automacoes/AutomationsSection";
import { IntegrationsSection } from "@/components/automacoes/IntegrationsSection";
import { CampaignsSection } from "@/components/campaigns/CampaignsSection";
import { useSearchParams } from "react-router-dom";

const normalizeTab = (tab: string | null) => {
  if (tab === "automacoes" || tab === "rules") return "automacoes";
  if (tab === "campanhas" || tab === "campaigns") return "campanhas";
  if (tab === "integracoes" || tab === "integrations" || tab === "whatsapp") return "integracoes";
  return "ia";
};

export default function Automacoes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("tab"));

  return (
    <div>
      <PageHeader title="Automações & IA" subtitle="Assistentes, regras automáticas, campanhas e integrações" />
      <Tabs
        value={activeTab}
        onValueChange={(tab) => setSearchParams({ tab })}
        className="space-y-6"
      >
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="ia">IA</TabsTrigger>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
        </TabsList>
        <TabsContent value="ia"><AISection /></TabsContent>
        <TabsContent value="automacoes"><AutomationsSection /></TabsContent>
        <TabsContent value="campanhas"><CampaignsSection /></TabsContent>
        <TabsContent value="integracoes"><IntegrationsSection /></TabsContent>
      </Tabs>
    </div>
  );
}
