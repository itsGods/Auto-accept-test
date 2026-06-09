import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetWelcomeMessages,
  useCreateWelcomeMessage,
  useUpdateWelcomeMessage,
  useDeleteWelcomeMessage,
  useActivateWelcomeMessage,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Star, StarOff, Edit2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InlineButtonBuilder,
  type InlineButtonGrid,
} from "@/components/ui/inline-button-builder";

type WelcomeMsg = {
  id: number;
  name: string;
  isActive?: boolean | null;
  messageText: string;
  parseMode?: string | null;
  photoUrl?: string | null;
  hasInlineButtons?: boolean | null;
  inlineButtons?: InlineButtonGrid | null;
};

export default function Welcome() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<WelcomeMsg | null>(null);
  const [form, setForm] = useState({
    name: "",
    messageText: "",
    parseMode: "Markdown",
    photoUrl: "",
    buttons: [] as InlineButtonGrid,
  });

  const { data: messages, isLoading } = useGetWelcomeMessages();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/welcome-messages"] });

  const { mutate: create, isPending: creating } = useCreateWelcomeMessage({
    mutation: {
      onSuccess: () => { toast({ title: "Welcome message created" }); invalidate(); closeDialog(); },
      onError: () => toast({ title: "Failed to create", variant: "destructive" }),
    },
  });

  const { mutate: update, isPending: updating } = useUpdateWelcomeMessage({
    mutation: {
      onSuccess: () => { toast({ title: "Welcome message updated" }); invalidate(); closeDialog(); },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    },
  });

  const { mutate: remove } = useDeleteWelcomeMessage({
    mutation: {
      onSuccess: () => { toast({ title: "Deleted" }); invalidate(); },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    },
  });

  const { mutate: activate } = useActivateWelcomeMessage({
    mutation: {
      onSuccess: () => { toast({ title: "Welcome message activated" }); invalidate(); },
      onError: () => toast({ title: "Failed to activate", variant: "destructive" }),
    },
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: "", messageText: "*Welcome!* Thank you for your interest.", parseMode: "Markdown", photoUrl: "", buttons: [] });
    setDialog(true);
  };

  const openEdit = (msg: WelcomeMsg) => {
    setEditTarget(msg);
    setForm({
      name: msg.name,
      messageText: msg.messageText,
      parseMode: msg.parseMode ?? "Markdown",
      photoUrl: msg.photoUrl ?? "",
      buttons: (msg.inlineButtons as InlineButtonGrid) ?? [],
    });
    setDialog(true);
  };

  const closeDialog = () => { setDialog(false); setEditTarget(null); };

  const handleSubmit = () => {
    const payload = {
      name: form.name,
      messageText: form.messageText,
      parseMode: form.parseMode,
      photoUrl: form.photoUrl || undefined,
      hasInlineButtons: form.buttons.length > 0,
      inlineButtons: form.buttons.length > 0 ? form.buttons : null,
    };
    if (editTarget) update({ id: editTarget.id, data: payload });
    else create({ data: payload });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Welcome Messages</h1>
          <p className="text-muted-foreground mt-1">Sent when users type /start — supports Markdown, images, and inline buttons</p>
        </div>
        <Button onClick={openCreate} className="self-start sm:self-auto">
          <Plus className="w-4 h-4 mr-1" />
          New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
        </div>
      ) : !messages?.length ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            No welcome messages yet. Create your first one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {messages.map((msg) => (
            <Card key={msg.id} className={`bg-card border-border ${msg.isActive ? "border-primary/50" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex flex-wrap items-center gap-2">
                    {msg.name}
                    {msg.isActive && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded border border-primary/30">
                        Active
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-8 w-8 p-0 ${msg.isActive ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}
                      onClick={() => activate({ id: msg.id })}
                    >
                      {msg.isActive ? <Star className="w-4 h-4" /> : <StarOff className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-primary hover:bg-primary/10" onClick={() => openEdit(msg as WelcomeMsg)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10" onClick={() => remove({ id: msg.id })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 rounded p-3 border border-border/50">
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-mono break-words">{msg.messageText}</pre>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                  <span>Mode: {msg.parseMode}</span>
                  {msg.photoUrl && <span>&bull; Has image</span>}
                  {msg.hasInlineButtons && (
                    <span className="text-primary">
                      &bull; {(msg.inlineButtons as InlineButtonGrid | null)?.flat().length ?? 0} button(s)
                    </span>
                  )}
                </div>
                {msg.hasInlineButtons && msg.inlineButtons && (
                  <div className="mt-2 space-y-1">
                    {(msg.inlineButtons as InlineButtonGrid).map((row: { text: string; url: string }[], i: number) => (
                      <div key={i} className="flex flex-wrap gap-1">
                        {row.map((btn, j: number) => (
                          <div key={j} className="text-xs bg-primary/10 text-primary border border-primary/20 rounded px-2 py-1">
                            {btn.text}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={closeDialog}>
        <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Welcome Message" : "New Welcome Message"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name</Label>
              <Input placeholder="e.g. Main Welcome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Message Text</Label>
              <Textarea
                placeholder={"Welcome message text...\n\nUse *bold*, _italic_, `code`, [link](url)"}
                value={form.messageText}
                onChange={(e) => setForm({ ...form, messageText: e.target.value })}
                className="mt-1 min-h-[140px] font-mono text-sm"
              />
            </div>
            <div>
              <Label>Parse Mode</Label>
              <Select value={form.parseMode} onValueChange={(v) => setForm({ ...form, parseMode: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Markdown">Markdown</SelectItem>
                  <SelectItem value="HTML">HTML</SelectItem>
                  <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Image URL (optional)</Label>
              <Input placeholder="https://example.com/image.jpg" value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} className="mt-1" />
            </div>
            <InlineButtonBuilder value={form.buttons} onChange={(buttons) => setForm({ ...form, buttons })} />
          </div>
          <DialogFooter className="mt-2 flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={closeDialog} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleSubmit} disabled={creating || updating || !form.name || !form.messageText} className="w-full sm:w-auto">
              {editTarget ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
