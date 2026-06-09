import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetUsers,
  useBlacklistUser,
  useUnblacklistUser,
  useSendDmToUser,
  getGetUsersQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Search, ChevronLeft, ChevronRight, Ban, ShieldCheck, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function Users() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterBlacklisted, setFilterBlacklisted] = useState<boolean | undefined>(undefined);

  const [blacklistDialog, setBlacklistDialog] = useState(false);
  const [blacklistTarget, setBlacklistTarget] = useState<number | null>(null);
  const [blacklistReason, setBlacklistReason] = useState("");

  const [dmDialog, setDmDialog] = useState(false);
  const [dmTarget, setDmTarget] = useState<number | null>(null);
  const [dmMessage, setDmMessage] = useState("");

  const { data, isLoading } = useGetUsers(
    { page, limit: 20, search: search || undefined, blacklisted: filterBlacklisted },
    { query: { queryKey: getGetUsersQueryKey({ page, limit: 20, search: search || undefined, blacklisted: filterBlacklisted }) } }
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/users"] });

  const { mutate: blacklist, isPending: blacklisting } = useBlacklistUser({
    mutation: {
      onSuccess: () => { toast({ title: "User blacklisted" }); invalidate(); setBlacklistDialog(false); },
      onError: () => toast({ title: "Failed to blacklist user", variant: "destructive" }),
    },
  });

  const { mutate: unblacklist, isPending: unblacklisting } = useUnblacklistUser({
    mutation: {
      onSuccess: () => { toast({ title: "User removed from blacklist" }); invalidate(); },
      onError: () => toast({ title: "Failed to unblacklist user", variant: "destructive" }),
    },
  });

  const { mutate: sendDm, isPending: sendingDm } = useSendDmToUser({
    mutation: {
      onSuccess: () => { toast({ title: "Message sent" }); setDmDialog(false); setDmMessage(""); },
      onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground mt-1">Manage all registered users</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filterBlacklisted === undefined ? "default" : "outline"}
          size="sm"
          onClick={() => { setFilterBlacklisted(undefined); setPage(1); }}
        >
          All
        </Button>
        <Button
          variant={filterBlacklisted === false ? "default" : "outline"}
          size="sm"
          onClick={() => { setFilterBlacklisted(false); setPage(1); }}
        >
          Active
        </Button>
        <Button
          variant={filterBlacklisted === true ? "default" : "outline"}
          size="sm"
          onClick={() => { setFilterBlacklisted(true); setPage(1); }}
          className={filterBlacklisted === true ? "" : "border-red-500/30 text-red-400"}
        >
          Blacklisted
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by username or name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" size="sm">Search</Button>
        {search && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setSearch(""); setSearchInput(""); }}>
            Clear
          </Button>
        )}
      </form>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {data ? `${data.total} users` : "Loading..."}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !data?.items.length ? (
            <div className="text-center py-12 text-muted-foreground">No users found.</div>
          ) : (
            <div className="space-y-2">
              {data.items.map((user) => (
                <div
                  key={user.id}
                  className="flex items-start justify-between gap-2 p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-border transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {user.firstName?.[0] ?? user.username?.[0] ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-sm">
                          {user.firstName ?? "Unknown"}
                        </span>
                        {user.username && (
                          <span className="text-muted-foreground text-sm truncate">@{user.username}</span>
                        )}
                        {user.isPremium && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/30 shrink-0">
                            Premium
                          </span>
                        )}
                        {user.isBlacklisted && (
                          <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30 shrink-0">
                            Blacklisted
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        <span>ID: {user.telegramId}</span>
                        <span className="hidden sm:inline"> &bull; {user.requestCount} requests &bull; Joined {new Date(user.joinedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                      onClick={() => { setDmTarget(user.id); setDmDialog(true); }}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    {user.isBlacklisted ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-green-400 hover:bg-green-500/10"
                        onClick={() => unblacklist({ id: user.id })}
                        disabled={unblacklisting}
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10"
                        onClick={() => { setBlacklistTarget(user.id); setBlacklistReason(""); setBlacklistDialog(true); }}
                      >
                        <Ban className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-sm text-muted-foreground">Page {page} of {data.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={blacklistDialog} onOpenChange={setBlacklistDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Blacklist User</DialogTitle></DialogHeader>
          <Input
            placeholder="Reason (optional)"
            value={blacklistReason}
            onChange={(e) => setBlacklistReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBlacklistDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => blacklistTarget && blacklist({ id: blacklistTarget, data: { reason: blacklistReason } })}
              disabled={blacklisting}
            >
              Blacklist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dmDialog} onOpenChange={setDmDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Send Direct Message</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Message (Markdown supported)</Label>
            <Textarea
              placeholder="Your message..."
              value={dmMessage}
              onChange={(e) => setDmMessage(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDmDialog(false)}>Cancel</Button>
            <Button
              onClick={() => dmTarget && sendDm({ id: dmTarget, data: { message: dmMessage, parseMode: "Markdown" } })}
              disabled={sendingDm || !dmMessage.trim()}
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
