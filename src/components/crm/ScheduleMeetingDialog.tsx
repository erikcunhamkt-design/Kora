import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatDate as intlDate } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (nextAction: string) => void;
}

export const ScheduleMeetingDialog = ({ open, onOpenChange, onSave }: Props) => {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setDate("");
      setTime("");
      setNotes("");
    }
  }, [open]);

  const handleSave = () => {
    if (!date) return toast.error("Selecione uma data");
    const dateLabel = intlDate(date + "T00:00", { day: "2-digit", month: "short" });
    const summary = `Reunião em ${dateLabel}${time ? ` às ${time}` : ""}${notes ? ` — ${notes}` : ""}`;
    onSave(summary);
    toast.success("Reunião agendada localmente");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Agendar reunião</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Salva localmente como próxima ação. Não conecta Google Calendar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Data*</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Hora</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-muted/50 border-border" />
          </div>
          <div className="col-span-2 space-y-2">
            <Label className="text-xs text-muted-foreground">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-muted/50 border-border min-h-[70px]" placeholder="Pauta, link da call..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="orbit-gradient text-white border-0" onClick={handleSave}>Agendar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
