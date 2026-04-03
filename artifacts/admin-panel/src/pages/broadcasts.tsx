import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetBroadcasts,
  useCreateBroadcast,
  useDeleteBroadcast,
  useSendBroadcast,
  getGetBroadcastsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Send, Trash2, Clock, CheckCircle2, AlertCircle } from "lucide-react";
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

export default function Broadcasts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [createDialog, setCreateDialog] = useState(false);
  const [form, setForm] = useState({
    title: "",
    messageText: "",
    parseMode: "Markdown",
    photoUrl: "",
    caption: "",
    targetFilter: "all",
  });

  const { data, isLoading } = useGetBroadcasts(
    { page },
    { query: { queryKey: getGetBroadcastsQueryKey({ page }) } }
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/broadcasts"] });

  const { mutate: create, isPending: creating } = useCreateBroadcast({
    mutation: {
      onSuccess: () => { toast({ title: "Broadcast created" }); invalidate(); setCreateDialog(false); resetForm(); },
      onError: () => toast({ title: "Failed to create broadcast", variant: "destructive" }),
    },
  });

  const { mutate: deleteBroadcast, isPending: deleting } = useDeleteBroadcast({
    mutation: {
      onSuccess: () => { toast({ title: "Broadcast deleted" }); invalidate(); },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    },
  });

  const { mutate: send, isPending: sending } = useSendBroadcast({
    mutation: {
      onSuccess: (data) => { toast({ title: `Sent to ${data.processed} users` }); invalidate(); },
      onError: () => toast({ title: "Failed to send broadcast", variant: "destructive" }),
    },
  });

  const resetForm = () => setForm({ title: "", messageText: "", parseMode: "Markdown", photoUrl: "", caption: "", targetFilter: "all" });

  const handleCreate = () => {
    create({
      data: {
        title: form.title,
        messageText: form.messageText,
        parseMode: form.parseMode,
        photoUrl: form.photoUrl || undefined,
        caption: form.caption || undefined,
        targetFilter: form.targetFilter,
      },
    });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "sent": return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case "sending": return <Clock className="w-4 h-4 text-yellow-400 animate-spin" />;
      case "scheduled": return <Clock className="w-4 h-4 text-blue-400" />;
      case "failed": return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const statusColors: Record<string, string> = {
    sent: "bg-green-500/20 text-green-400 border-green-500/30",
    sending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    scheduled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    failed: "bg-red-500/20 text-red-400 border-red-500/30",
    draft: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Broadcasts</h1>
          <p className="text-muted-foreground mt-1">Send messages to all your users</p>
        </div>
        <Button onClick={() => setCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-1" />
          New Broadcast
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {data ? `${data.total} broadcasts` : "Loading..."}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : !data?.items.length ? (
            <div className="text-center py-12 text-muted-foreground">No broadcasts yet. Create your first one!</div>
          ) : (
            <div className="space-y-3">
              {data.items.map((b) => (
                <div key={b.id} className="p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-border transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {statusIcon(b.status ?? "draft")}
                        <span className="font-medium text-sm">{b.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded border capitalize ${statusColors[b.status ?? "draft"]}`}>
                          {b.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{b.messageText}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>Created {new Date(b.createdAt).toLocaleDateString()}</span>
                        {b.status === "sent" && (
                          <>
                            <span>&bull;</span>
                            <span>{b.successCount}/{b.totalRecipients} delivered</span>
                            {b.failCount > 0 && <span className="text-red-400">{b.failCount} failed</span>}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-4">
                      {(b.status === "draft" || b.status === "scheduled") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-primary hover:bg-primary/10"
                          onClick={() => send({ id: b.id })}
                          disabled={sending}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:bg-red-500/10"
                        onClick={() => deleteBroadcast({ id: b.id })}
                        disabled={deleting}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>New Broadcast</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                placeholder="Broadcast title..."
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                placeholder="Your message (Markdown supported)..."
                value={form.messageText}
                onChange={(e) => setForm({ ...form, messageText: e.target.value })}
                className="mt-1 min-h-[120px]"
              />
            </div>
            <div>
              <Label>Parse Mode</Label>
              <Select value={form.parseMode} onValueChange={(v) => setForm({ ...form, parseMode: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Markdown">Markdown</SelectItem>
                  <SelectItem value="HTML">HTML</SelectItem>
                  <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Photo URL (optional)</Label>
              <Input
                placeholder="https://example.com/image.jpg"
                value={form.photoUrl}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                className="mt-1"
              />
            </div>
            {form.photoUrl && (
              <div>
                <Label>Caption (optional)</Label>
                <Input
                  placeholder="Caption for the image..."
                  value={form.caption}
                  onChange={(e) => setForm({ ...form, caption: e.target.value })}
                  className="mt-1"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreateDialog(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !form.title || !form.messageText}>
              Create Broadcast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
