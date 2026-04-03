import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Star, StarOff, Edit2, CheckCircle2, XCircle } from "lucide-react";
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

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchJson(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

type MsgTemplate = {
  id: number;
  name: string;
  isActive?: boolean | null;
  messageText: string;
  parseMode?: string | null;
  photoUrl?: string | null;
  hasInlineButtons?: boolean | null;
  inlineButtons?: InlineButtonGrid | null;
  createdAt?: string | null;
};

type RejectionMsg = {
  id: number;
  name: string;
  isActive?: boolean | null;
  messageText: string;
  parseMode?: string | null;
  createdAt?: string | null;
};

// ─── Approval Messages Section ─────────────────────────────────────────────────

function ApprovalMessages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<MsgTemplate | null>(null);
  const [form, setForm] = useState({
    name: "",
    messageText: "",
    parseMode: "Markdown",
    photoUrl: "",
    buttons: [] as InlineButtonGrid,
  });

  const { data: messages, isLoading } = useQuery<MsgTemplate[]>({
    queryKey: ["/api/approval-messages"],
    queryFn: () => fetchJson(`${API}/api/approval-messages`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/approval-messages"] });

  const createMut = useMutation({
    mutationFn: (data: unknown) =>
      fetchJson(`${API}/api/approval-messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Approval message created" }); invalidate(); closeDialog(); },
    onError: () => toast({ title: "Failed to create", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      fetchJson(`${API}/api/approval-messages/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Updated" }); invalidate(); closeDialog(); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      fetchJson(`${API}/api/approval-messages/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Deleted" }); invalidate(); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const activateMut = useMutation({
    mutationFn: (id: number) =>
      fetchJson(`${API}/api/approval-messages/${id}/activate`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Approval message activated" }); invalidate(); },
    onError: () => toast({ title: "Failed to activate", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: "", messageText: "*Congratulations!* Your join request has been approved. Welcome!", parseMode: "Markdown", photoUrl: "", buttons: [] });
    setDialog(true);
  };

  const openEdit = (msg: MsgTemplate) => {
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
    if (editTarget) updateMut.mutate({ id: editTarget.id, data: payload });
    else createMut.mutate(payload);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Sent to users via DM when their request is <span className="text-green-400 font-medium">approved</span>. Supports Markdown, images, and inline buttons.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />
          New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}</div>
      ) : !messages?.length ? (
        <Card className="bg-card border-border">
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No approval message templates yet. The bot uses a built-in default when none are configured.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <Card key={msg.id} className={`bg-card border-border ${msg.isActive ? "border-green-500/40" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    {msg.name}
                    {msg.isActive && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30">Active</span>
                    )}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className={msg.isActive ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"} onClick={() => activateMut.mutate(msg.id)}>
                      {msg.isActive ? <Star className="w-4 h-4" /> : <StarOff className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEdit(msg)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => deleteMut.mutate(msg.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 rounded p-3 border border-border/50">
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">{msg.messageText}</pre>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
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
                    {(msg.inlineButtons as InlineButtonGrid).map((row, i) => (
                      <div key={i} className="flex gap-1">
                        {row.map((btn, j) => (
                          <div key={j} className="text-xs bg-primary/10 text-primary border border-primary/20 rounded px-2 py-1 flex items-center gap-1">
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
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Approval Message" : "New Approval Message"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name</Label>
              <Input placeholder="e.g. Main Approval" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Message Text</Label>
              <Textarea placeholder="Write your approval message here... Markdown is supported." value={form.messageText} onChange={(e) => setForm({ ...form, messageText: e.target.value })} className="mt-1 min-h-[120px] font-mono text-sm" />
              <p className="text-xs text-muted-foreground mt-1">Use *bold*, _italic_, `code`, [links](url)</p>
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
          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending || !form.name || !form.messageText}>
              {editTarget ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Rejection Messages Section ────────────────────────────────────────────────

function RejectionMessages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<RejectionMsg | null>(null);
  const [form, setForm] = useState({ name: "", messageText: "", parseMode: "Markdown" });

  const { data: messages, isLoading } = useQuery<RejectionMsg[]>({
    queryKey: ["/api/rejection-messages"],
    queryFn: () => fetchJson(`${API}/api/rejection-messages`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/rejection-messages"] });

  const createMut = useMutation({
    mutationFn: (data: unknown) =>
      fetchJson(`${API}/api/rejection-messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Rejection message created" }); invalidate(); closeDialog(); },
    onError: () => toast({ title: "Failed to create", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      fetchJson(`${API}/api/rejection-messages/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Updated" }); invalidate(); closeDialog(); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      fetchJson(`${API}/api/rejection-messages/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Deleted" }); invalidate(); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const activateMut = useMutation({
    mutationFn: (id: number) =>
      fetchJson(`${API}/api/rejection-messages/${id}/activate`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Rejection message activated" }); invalidate(); },
    onError: () => toast({ title: "Failed to activate", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: "", messageText: "We're sorry, your join request has been declined.", parseMode: "Markdown" });
    setDialog(true);
  };

  const openEdit = (msg: RejectionMsg) => {
    setEditTarget(msg);
    setForm({ name: msg.name, messageText: msg.messageText, parseMode: msg.parseMode ?? "Markdown" });
    setDialog(true);
  };

  const closeDialog = () => { setDialog(false); setEditTarget(null); };

  const handleSubmit = () => {
    const payload = { name: form.name, messageText: form.messageText, parseMode: form.parseMode };
    if (editTarget) updateMut.mutate({ id: editTarget.id, data: payload });
    else createMut.mutate(payload);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Sent to users via DM when their request is <span className="text-red-400 font-medium">rejected</span>.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />
          New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : !messages?.length ? (
        <Card className="bg-card border-border">
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No rejection message templates yet. The bot uses a built-in default.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <Card key={msg.id} className={`bg-card border-border ${msg.isActive ? "border-red-500/40" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    {msg.name}
                    {msg.isActive && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">Active</span>
                    )}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className={msg.isActive ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"} onClick={() => activateMut.mutate(msg.id)}>
                      {msg.isActive ? <Star className="w-4 h-4" /> : <StarOff className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEdit(msg)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => deleteMut.mutate(msg.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 rounded p-3 border border-border/50">
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">{msg.messageText}</pre>
                </div>
                <div className="text-xs text-muted-foreground mt-2">Mode: {msg.parseMode}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={closeDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Rejection Message" : "New Rejection Message"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name</Label>
              <Input placeholder="e.g. Standard Rejection" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Message Text</Label>
              <Textarea placeholder="Write your rejection message..." value={form.messageText} onChange={(e) => setForm({ ...form, messageText: e.target.value })} className="mt-1 min-h-[100px] font-mono text-sm" />
              <p className="text-xs text-muted-foreground mt-1">If a reason was given when rejecting, it will be appended automatically.</p>
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
          </div>
          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending || !form.name || !form.messageText}>
              {editTarget ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page with Tabs ───────────────────────────────────────────────────────

type Tab = "approval" | "rejection";

export default function Messages() {
  const [tab, setTab] = useState<Tab>("approval");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Response Messages</h1>
        <p className="text-muted-foreground mt-1">
          Customize the DMs sent to users after their request is approved or rejected
        </p>
      </div>

      <div className="flex gap-2 border-b border-border pb-0">
        <button
          onClick={() => setTab("approval")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === "approval"
              ? "border-green-400 text-green-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Approval Messages
        </button>
        <button
          onClick={() => setTab("rejection")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === "rejection"
              ? "border-red-400 text-red-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Rejection Messages
        </button>
      </div>

      {tab === "approval" ? <ApprovalMessages /> : <RejectionMessages />}
    </div>
  );
}
