import { useState } from "react";
import { useGetDailyAnalytics, useGetDashboardStats, getGetDailyAnalyticsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const PERIODS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
];

export default function Analytics() {
  const [days, setDays] = useState(7);
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: daily, isLoading: dailyLoading } = useGetDailyAnalytics(
    { days },
    { query: { queryKey: getGetDailyAnalyticsQueryKey({ days }) } }
  );

  const chartData = daily?.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
    Requests: d.totalRequests,
    Approved: d.approved,
    Rejected: d.rejected,
    "New Users": d.newUsers,
  }));

  const customTooltipStyle = {
    backgroundColor: "hsl(222 47% 11%)",
    border: "1px solid hsl(217 32% 17%)",
    borderRadius: "8px",
    color: "hsl(210 40% 98%)",
    fontSize: "12px",
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">Track your bot's performance over time</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              variant={days === p.value ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : stats && [
              { label: "Total Users", value: stats.totalUsers, color: "text-primary" },
              { label: "Approval Rate", value: `${stats.approvalRate}%`, color: "text-green-400" },
              { label: "Total Pending", value: stats.totalPending, color: "text-yellow-400" },
              { label: "Blacklisted", value: stats.blacklistedUsers, color: "text-red-400" },
            ].map(({ label, value, color }) => (
              <Card key={label} className="bg-card border-border">
                <CardContent className="pt-4 pb-4">
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{label}</div>
                </CardContent>
              </Card>
            ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Request Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 17%)" />
                <XAxis dataKey="date" tick={{ fill: "hsl(215 20.2% 65.1%)", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(215 20.2% 65.1%)", fontSize: 11 }} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line type="monotone" dataKey="Requests" stroke="hsl(199 89% 48%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Approved" stroke="hsl(160 84% 39%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Rejected" stroke="hsl(0 62.8% 50%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">New Users</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 17%)" />
                <XAxis dataKey="date" tick={{ fill: "hsl(215 20.2% 65.1%)", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(215 20.2% 65.1%)", fontSize: 11 }} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Bar dataKey="New Users" fill="hsl(224 76% 48%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[360px] px-2">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Date</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Total</th>
                    <th className="text-right py-2 px-2 text-green-400 font-medium">Approved</th>
                    <th className="text-right py-2 px-2 text-red-400 font-medium">Rejected</th>
                    <th className="text-right py-2 px-2 text-primary font-medium">New Users</th>
                  </tr>
                </thead>
                <tbody>
                  {daily?.map((d) => (
                    <tr key={d.date} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-2 px-2 text-muted-foreground text-xs">{new Date(d.date).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}</td>
                      <td className="py-2 px-2 text-right">{d.totalRequests}</td>
                      <td className="py-2 px-2 text-right text-green-400">{d.approved}</td>
                      <td className="py-2 px-2 text-right text-red-400">{d.rejected}</td>
                      <td className="py-2 px-2 text-right text-primary">{d.newUsers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
