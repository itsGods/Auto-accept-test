import { useGetDashboardStats, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  UserCheck, 
  UserMinus, 
  Clock, 
  Activity, 
  Send, 
  AlertOctagon, 
  Radio
} from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Real-time overview of your bot operations.</p>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Users" value={stats.totalUsers} icon={Users} />
          <StatCard title="Total Pending" value={stats.totalPending} icon={Clock} trend="Today: +" trendValue={stats.todayRequests} />
          <StatCard title="Total Approved" value={stats.totalApproved} icon={UserCheck} trend="Rate: " trendValue={`${Math.round(stats.approvalRate * 100)}%`} />
          <StatCard title="Total Rejected" value={stats.totalRejected} icon={UserMinus} />
          
          <StatCard title="Today Requests" value={stats.todayRequests} icon={Activity} />
          <StatCard title="Today Approved" value={stats.todayApproved} icon={UserCheck} />
          <StatCard title="Broadcasts Sent" value={stats.broadcastsSent} icon={Send} />
          <StatCard title="Active Channels" value={stats.activeChannels} icon={Radio} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-4">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-4 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="p-2 bg-primary/10 rounded-full text-primary">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        <span className="text-primary">{item.userDisplay}</span> - {item.type}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(item.timestamp).toLocaleString()} {item.channelTitle && `in ${item.channelTitle}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity to show.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendValue }: any) {
  return (
    <Card className="bg-card border-border shadow-sm overflow-hidden relative group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon className="w-24 h-24" />
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value.toLocaleString()}</div>
        {(trend || trendValue) && (
          <p className="text-xs text-primary font-medium mt-2">
            {trend}{trendValue}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
