import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAdmins,
  useAddAdmin,
  useUpdateAdmin,
  useRemoveAdmin,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ShieldAlert } from "lucide-react";
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

export default function Admins() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({
    telegramId: "",
    username: "",
    firstName: "",
    role: "moderator",
    canApprove: true,
    canBroadcast: false,
    canManageAdmins: false,
    canManageSettings: false,
  });

  const { data: admins, isLoading } = useGetAdmins();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/admins"] });

  const { mutate: addAdmin, isPending: adding } = useAddAdmin({
    mutation: {
      onSuccess: () => { toast({ title: "Admin added" }); invalidate(); setDialog(false); resetForm(); },
      onError: () => toast({ title: "Failed to add admin", variant: "destructive" }),
    },
  });

  const { mutate: removeAdmin } = useRemoveAdmin({
    mutation: {
      onSuccess: () => { toast({ title: "Admin removed" }); invalidate(); },
      onError: () => toast({ title: "Failed to remove admin", variant: "destructive" }),
    },
  });

  const resetForm = () => setForm({
    telegramId: "", username: "", firstName: "", role: "moderator",
    canApprove: true, canBroadcast: false, canManageAdmins: false, canManageSettings: false,
  });

  const handleAdd = () => {
    if (!form.telegramId) return;
    addAdmin({
      data: {
        telegramId: parseInt(form.telegramId),
        username: form.username || undefined,
        firstName: form.firstName || undefined,
        role: form.role as "admin" | "moderator",
        canApprove: form.canApprove,
        canBroadcast: form.canBroadcast,
        canManageAdmins: form.canManageAdmins,
        canManageSettings: form.canManageSettings,
      },
    });
  };

  const roleColors: Record<string, string> = {
    admin: "bg-primary/20 text-primary border-primary/30",
    moderator: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground mt-1">Manage bot administrators and permissions</p>
        </div>
        <Button onClick={() => setDialog(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Add Admin
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {admins ? `${admins.length} admins` : "Loading..."}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : !admins?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              No admins configured. Add your first admin above.
            </div>
          ) : (
            <div className="space-y-3">
              {admins.map((admin) => (
                <div key={admin.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {admin.firstName ?? "Admin"}
                          {admin.username && <span className="text-muted-foreground ml-1">@{admin.username}</span>}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded border capitalize ${roleColors[admin.role] ?? roleColors.moderator}`}>
                          {admin.role}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        ID: {admin.telegramId} &bull; Added {new Date(admin.addedAt).toLocaleDateString()}
                      </div>
                      <div className="flex gap-2 mt-1">
                        {admin.canApprove && <PermBadge>Approve</PermBadge>}
                        {admin.canBroadcast && <PermBadge>Broadcast</PermBadge>}
                        {admin.canManageAdmins && <PermBadge>Manage Admins</PermBadge>}
                        {admin.canManageSettings && <PermBadge>Settings</PermBadge>}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:bg-red-500/10"
                    onClick={() => removeAdmin({ id: admin.id })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Add Admin</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Telegram ID *</Label>
              <Input
                placeholder="e.g. 123456789"
                value={form.telegramId}
                onChange={(e) => setForm({ ...form, telegramId: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name</Label>
                <Input placeholder="John" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Username</Label>
                <Input placeholder="john_doe" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>Permissions</Label>
              {[
                { key: "canApprove", label: "Can Approve/Reject Requests" },
                { key: "canBroadcast", label: "Can Send Broadcasts" },
                { key: "canManageAdmins", label: "Can Manage Admins" },
                { key: "canManageSettings", label: "Can Change Settings" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-sm font-normal">{label}</Label>
                  <Switch
                    checked={form[key as keyof typeof form] as boolean}
                    onCheckedChange={(v) => setForm({ ...form, [key]: v })}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDialog(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleAdd} disabled={adding || !form.telegramId}>Add Admin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PermBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
      {children}
    </span>
  );
}
