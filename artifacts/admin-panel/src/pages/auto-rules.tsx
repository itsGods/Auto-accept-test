import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAutoRules,
  useCreateAutoRule,
  useUpdateAutoRule,
  useDeleteAutoRule,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, CheckCircle2, XCircle, Edit2 } from "lucide-react";
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

type AutoRule = {
  id: number;
  name: string;
  isActive?: boolean | null;
  ruleType: string;
  pattern: string;
  action: string;
  priority?: number | null;
  createdAt: string;
};

export default function AutoRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<AutoRule | null>(null);
  const [form, setForm] = useState({
    name: "",
    ruleType: "username",
    pattern: "",
    action: "approve",
    isActive: true,
    priority: 0,
  });

  const { data: rules, isLoading } = useGetAutoRules();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/auto-rules"] });

  const { mutate: create, isPending: creating } = useCreateAutoRule({
    mutation: {
      onSuccess: () => { toast({ title: "Rule created" }); invalidate(); closeDialog(); },
      onError: () => toast({ title: "Failed to create rule", variant: "destructive" }),
    },
  });

  const { mutate: update, isPending: updating } = useUpdateAutoRule({
    mutation: {
      onSuccess: () => { toast({ title: "Rule updated" }); invalidate(); closeDialog(); },
      onError: () => toast({ title: "Failed to update rule", variant: "destructive" }),
    },
  });

  const { mutate: remove } = useDeleteAutoRule({
    mutation: {
      onSuccess: () => { toast({ title: "Rule deleted" }); invalidate(); },
      onError: () => toast({ title: "Failed to delete rule", variant: "destructive" }),
    },
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: "", ruleType: "username", pattern: "", action: "approve", isActive: true, priority: 0 });
    setDialog(true);
  };

  const openEdit = (rule: AutoRule) => {
    setEditTarget(rule);
    setForm({
      name: rule.name,
      ruleType: rule.ruleType,
      pattern: rule.pattern,
      action: rule.action,
      isActive: rule.isActive ?? true,
      priority: rule.priority ?? 0,
    });
    setDialog(true);
  };

  const closeDialog = () => { setDialog(false); setEditTarget(null); };

  const handleSubmit = () => {
    const payload = {
      name: form.name,
      ruleType: form.ruleType,
      pattern: form.pattern,
      action: form.action,
      isActive: form.isActive,
      priority: form.priority,
    };
    if (editTarget) {
      update({ id: editTarget.id, data: payload });
    } else {
      create({ data: payload });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Auto Rules</h1>
          <p className="text-muted-foreground mt-1">Automatically approve or reject requests based on rules</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />
          Add Rule
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Rules are evaluated in priority order (highest first)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !rules?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              No auto rules configured. Add rules to automatically handle requests.
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    rule.isActive
                      ? "bg-muted/30 border-border/50 hover:border-border"
                      : "bg-muted/10 border-border/20 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${rule.action === "approve" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                      {rule.action === "approve"
                        ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                        : <XCircle className="w-4 h-4 text-red-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{rule.name}</span>
                        {!rule.isActive && <span className="text-xs text-muted-foreground">(disabled)</span>}
                      </div>
                      <div className="flex gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>Type: {rule.ruleType}</span>
                        <span>&bull;</span>
                        <span>Pattern: <code className="bg-muted px-1 rounded">{rule.pattern}</code></span>
                        <span>&bull;</span>
                        <span className={rule.action === "approve" ? "text-green-400" : "text-red-400"}>
                          Action: {rule.action}
                        </span>
                        <span>&bull;</span>
                        <span>Priority: {rule.priority ?? 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEdit(rule)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => remove({ id: rule.id })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={closeDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Rule" : "New Auto Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rule Name</Label>
              <Input placeholder="e.g. Auto-approve premium users" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Rule Type</Label>
                <Select value={form.ruleType} onValueChange={(v) => setForm({ ...form, ruleType: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="username">Username Pattern</SelectItem>
                    <SelectItem value="any">Match All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Action</Label>
                <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approve">Approve</SelectItem>
                    <SelectItem value="reject">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.ruleType === "username" && (
              <div>
                <Label>Pattern (Regex)</Label>
                <Input
                  placeholder="e.g. ^admin_ or bot$"
                  value={form.pattern}
                  onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                  className="mt-1 font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">JavaScript RegEx pattern matched against the username</p>
              </div>
            )}
            {form.ruleType === "any" && (
              <div>
                <Label>Pattern</Label>
                <Input value="*" disabled className="mt-1 font-mono opacity-50" />
                <p className="text-xs text-muted-foreground mt-1">This rule matches all users</p>
              </div>
            )}
            <div>
              <Label>Priority (higher = evaluated first)</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                className="mt-1 max-w-[120px]"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={creating || updating || !form.name || !form.pattern}>
              {editTarget ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
