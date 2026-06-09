import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetJoinRequests,
  useApproveRequest,
  useRejectRequest,
  useApproveAllRequests,
  useRejectAllRequests,
  getGetJoinRequestsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Search, ChevronLeft, ChevronRight, CheckCheck, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Status = "all" | "pending" | "approved" | "rejected";

export default function Requests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("pending");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectAllDialogOpen, setRejectAllDialogOpen] = useState(false);

  const { data, isLoading } = useGetJoinRequests(
    { status, page, limit: 15, search: search || undefined },
    { query: { queryKey: getGetJoinRequestsQueryKey({ status, page, limit: 15, search: search || undefined }) } }
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/requests"] });

  const { mutate: approve, isPending: approving } = useApproveRequest({
    mutation: {
      onSuccess: () => { toast({ title: "Request approved" }); invalidate(); },
      onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
    },
  });

  const { mutate: reject, isPending: rejecting } = useRejectRequest({
    mutation: {
      onSuccess: () => { toast({ title: "Request rejected" }); invalidate(); setRejectDialogOpen(false); },
      onError: () => toast({ title: "Failed to reject", variant: "destructive" }),
    },
  });

  const { mutate: approveAll, isPending: approvingAll } = useApproveAllRequests({
    mutation: {
      onSuccess: (data) => { toast({ title: `Approved ${data.processed} requests` }); invalidate(); },
      onError: () => toast({ title: "Failed to approve all", variant: "destructive" }),
    },
  });

  const { mutate: rejectAll, isPending: rejectingAll } = useRejectAllRequests({
    mutation: {
      onSuccess: (data) => { toast({ title: `Rejected ${data.processed} requests` }); invalidate(); setRejectAllDialogOpen(false); },
      onError: () => toast({ title: "Failed to reject all", variant: "destructive" }),
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const openRejectDialog = (id: number) => {
    setRejectTarget(id);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    approved: "bg-green-500/20 text-green-400 border-green-500/30",
    rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Join Requests</h1>
          <p className="text-muted-foreground mt-1">Manage channel join requests</p>
        </div>
        {status === "pending" && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => approveAll({})}
              disabled={approvingAll}
              className="border-green-500/30 text-green-400 hover:bg-green-500/10"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Approve All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectAllDialogOpen(true)}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <X className="w-4 h-4 mr-1" />
              Reject All
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "pending", "approved", "rejected"] as Status[]).map((s) => (
          <Button
            key={s}
            variant={status === s ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatus(s); setPage(1); }}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by username..."
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
            {data ? `${data.total} total requests` : "Loading..."}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !data?.items.length ? (
            <div className="text-center py-12 text-muted-foreground">
              No {status === "all" ? "" : status} requests found.
            </div>
          ) : (
            <div className="space-y-2">
              {data.items.map((req) => (
                <div
                  key={req.id}
                  className="flex items-start justify-between gap-2 p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-border transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {req.user?.firstName?.[0] ?? req.user?.username?.[0] ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-sm truncate">
                          {req.user?.firstName ?? "Unknown"}
                        </span>
                        {req.user?.username && (
                          <span className="text-muted-foreground text-sm truncate">@{req.user.username}</span>
                        )}
                        {req.user?.isPremium && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/30 shrink-0">
                            Premium
                          </span>
                        )}
                        {req.user?.isBlacklisted && (
                          <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30 shrink-0">
                            Blacklisted
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 space-x-1">
                        <span>ID: {req.userId}</span>
                        <span>&bull;</span>
                        <span className="truncate">{req.channelTitle ?? `Channel ${req.channelId}`}</span>
                        <span className="hidden sm:inline">&bull; {new Date(req.requestedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-2 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded border capitalize whitespace-nowrap ${statusColors[req.status ?? "pending"]}`}>
                      {req.status}
                    </span>
                    {req.status === "pending" && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-green-400 hover:bg-green-500/10 hover:text-green-300"
                          onClick={() => approve({ id: req.id })}
                          disabled={approving}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => openRejectDialog(req.id)}
                          disabled={rejecting}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    {req.status === "rejected" && req.rejectionReason && (
                      <span className="text-xs text-muted-foreground max-w-[100px] truncate hidden sm:block">
                        {req.rejectionReason}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Rejection reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectTarget && reject({ id: rejectTarget, data: { reason: rejectReason } })}
              disabled={rejecting}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectAllDialogOpen} onOpenChange={setRejectAllDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Reject All Pending Requests</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">This will reject all pending requests. Add an optional reason below.</p>
          <Textarea
            placeholder="Rejection reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectAllDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectAll({ data: { reason: rejectReason } })}
              disabled={rejectingAll}
            >
              Reject All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
