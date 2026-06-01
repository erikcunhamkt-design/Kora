import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";
import { AccessibilityOnboardingDialog } from "@/components/accessibility/AccessibilityOnboardingDialog";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AccessibilityOnboardingDialog />
      <div className="min-h-screen flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen">
          <TopBar />
          <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col justify-between">
            <div className="mx-auto w-full max-w-[1600px] p-6 w-full flex-1">
              {children}
            </div>
            <Footer />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

