import { useEffect, useState } from "react";
import { useGetSettings, useUpdateSettings, useGetBotInfo } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Bot, Save } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const { data: botInfo, isLoading: botInfoLoading } = useGetBotInfo();
  const { data: settings, isLoading } = useGetSettings();
  const { mutate: updateSettings, isPending: saving } = useUpdateSettings({
    mutation: {
      onSuccess: () => toast({ title: "Settings saved" }),
      onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
    },
  });

  const [form, setForm] = useState({
    welcomeEnabled: true,
    autoApproveEnabled: false,
    autoRejectEnabled: false,
    cooldownSeconds: 0,
    maxRequestsPerUser: 3,
    notifyAdminOnRequest: true,
    notifyAdminOnApproval: false,
    requireChannelMembership: false,
    botLanguage: "en",
    maintenanceMode: false,
    customStartMessage: "",
    customHelpMessage: "",
    antiSpamEnabled: true,
    deepLinkEnabled: true,
  });

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  const toggleField = (key: keyof typeof form) => {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    updateSettings({ data: form });
  };

  const toggleSettings = [
    { key: "welcomeEnabled", label: "Welcome Message", desc: "Send welcome message when users /start the bot" },
    { key: "autoApproveEnabled", label: "Auto-Approve", desc: "Automatically approve all join requests" },
    { key: "autoRejectEnabled", label: "Auto-Reject", desc: "Automatically reject all join requests" },
    { key: "notifyAdminOnRequest", label: "Notify Admins on Request", desc: "Send admins a DM when a new request arrives" },
    { key: "notifyAdminOnApproval", label: "Notify Admins on Approval", desc: "Send admins a DM when a request is approved" },
    { key: "requireChannelMembership", label: "Require Channel Membership", desc: "Users must be in a channel to make requests" },
    { key: "maintenanceMode", label: "Maintenance Mode", desc: "Bot replies with maintenance message to all users" },
    { key: "antiSpamEnabled", label: "Anti-Spam Protection", desc: "Rate limit repeated join requests" },
    { key: "deepLinkEnabled", label: "Deep Links", desc: "Enable referral deep link generation" },
  ] as const;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your bot behavior</p>
        </div>
        <Button onClick={handleSave} disabled={saving || isLoading}>
          <Save className="w-4 h-4 mr-1" />
          Save Settings
        </Button>
      </div>

      {/* Bot Info */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bot Information</CardTitle>
        </CardHeader>
        <CardContent>
          {botInfoLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : botInfo ? (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Bot className="w-7 h-7" />
              </div>
              <div>
                <div className="font-semibold text-lg">{botInfo.firstName}</div>
                <div className="text-muted-foreground text-sm">@{botInfo.username}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className={`w-2 h-2 rounded-full ${botInfo.isOnline ? "bg-green-400" : "bg-red-400"}`} />
                  <span className="text-xs text-muted-foreground">{botInfo.isOnline ? "Online" : "Offline"}</span>
                  <span className="text-xs text-muted-foreground">&bull; ID: {botInfo.id}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Could not fetch bot info</p>
          )}
        </CardContent>
      </Card>

      {/* Toggle Settings */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bot Behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            : toggleSettings.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                  </div>
                  <Switch
                    checked={form[key as keyof typeof form] as boolean}
                    onCheckedChange={() => toggleField(key as keyof typeof form)}
                  />
                </div>
              ))}
        </CardContent>
      </Card>

      {/* Numeric Settings */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Limits & Cooldowns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cooldown (seconds)</Label>
                <Input
                  type="number"
                  value={form.cooldownSeconds}
                  onChange={(e) => setForm({ ...form, cooldownSeconds: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Max Requests Per User</Label>
                <Input
                  type="number"
                  value={form.maxRequestsPerUser}
                  onChange={(e) => setForm({ ...form, maxRequestsPerUser: parseInt(e.target.value) || 1 })}
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Messages */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Custom Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <>
              <div>
                <Label>Custom /start Message</Label>
                <Input
                  placeholder="Leave empty to use the active welcome message template"
                  value={form.customStartMessage}
                  onChange={(e) => setForm({ ...form, customStartMessage: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Custom /help Message</Label>
                <Input
                  placeholder="Leave empty to use the default help text"
                  value={form.customHelpMessage}
                  onChange={(e) => setForm({ ...form, customHelpMessage: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Bot Language</Label>
                <Input
                  placeholder="en"
                  value={form.botLanguage}
                  onChange={(e) => setForm({ ...form, botLanguage: e.target.value })}
                  className="mt-1 max-w-[120px]"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
