import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { PublicProfile as ProfileT, readPublicProfile } from "@/hooks/usePublicProfile";
import { Button } from "@/components/ui/button";
import { Globe, Mail, MapPin, MessageCircle } from "lucide-react";

export default function PublicProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<ProfileT | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setProfile(readPublicProfile());
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  if (!profile || !profile.published || profile.slug !== slug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl mx-auto bg-muted flex items-center justify-center">
            <Globe className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Página não encontrada</h1>
          <p className="text-sm text-muted-foreground">
            A página pública que você procura não existe ou ainda não foi publicada.
          </p>
        </div>
      </div>
    );
  }

  const color = profile.primaryColor;

  return (
    <div className="min-h-screen bg-background">
      <div
        className="relative px-6 py-20 text-center"
        style={{ background: `linear-gradient(135deg, ${color}22, transparent)` }}
      >
        <div className="max-w-3xl mx-auto space-y-4">
          <div
            className="inline-block px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: `${color}22`, color }}
          >
            {profile.studioName}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
            {profile.headline}
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            {profile.description}
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground pt-4">
            {profile.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {profile.location}</span>}
            {profile.contactEmail && <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {profile.contactEmail}</span>}
            {profile.whatsapp && <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> {profile.whatsapp}</span>}
          </div>
          <div className="pt-4">
            <Button style={{ background: color }} className="text-white border-0 h-11 px-6">
              Fale com o estúdio
            </Button>
          </div>
        </div>
      </div>

      {profile.showServices && (
        <section className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-foreground mb-6">Serviços</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {["Branding", "Web Design", "Conteúdo"].map((s) => (
              <div key={s} className="orbit-card p-6">
                <h3 className="font-semibold text-foreground">{s}</h3>
                <p className="text-sm text-muted-foreground mt-2">Soluções completas com entrega ágil e estratégica.</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {profile.showPortfolio && (
        <section className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-foreground mb-6">Projetos publicados</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="orbit-card aspect-video flex items-center justify-center text-muted-foreground">
                Projeto {i}
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {profile.studioName}
      </footer>
    </div>
  );
}
