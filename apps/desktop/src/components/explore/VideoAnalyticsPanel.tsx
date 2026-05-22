import { format, subDays } from "date-fns";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDb } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { DailyMetrics, VideoAnalytics } from "@/lib/youtube-analytics-api";
import {
  getChannelDailyMetrics,
  getVideoAnalytics,
} from "@/lib/youtube-analytics-api";
import { getStoredTokens, getValidAccessToken } from "@/lib/youtube-oauth";

interface ThumbnailHistoryEntry {
  id: string;
  videoId: string;
  thumbnailUrl: string;
  projectId: string | null;
  note: string | null;
  uploadedAt: number;
}

interface VideoAnalyticsPanelProps {
  videoId: string | null;
  onClose: () => void;
}

type DateRange = "7d" | "28d" | "90d";

const DATE_RANGE_OPTIONS: { value: DateRange; label: string; days: number }[] =
  [
    { value: "7d", label: "7 days", days: 7 },
    { value: "28d", label: "28 days", days: 28 },
    { value: "90d", label: "90 days", days: 90 },
  ];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

export function VideoAnalyticsPanel({
  videoId,
  onClose,
}: VideoAnalyticsPanelProps) {
  const [dateRange, setDateRange] = useState<DateRange>("28d");
  const [analytics, setAnalytics] = useState<VideoAnalytics | null>(null);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([]);
  const [thumbnailHistory, setThumbnailHistory] = useState<
    ThumbnailHistoryEntry[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setAnalytics(null);
      setDailyMetrics([]);

      try {
        const [token, storedTokens] = await Promise.all([
          getValidAccessToken(),
          getStoredTokens(),
        ]);

        if (!(token && storedTokens?.channelId)) {
          if (!cancelled) setError("YouTube account not connected.");
          return;
        }

        const days =
          DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.days ?? 28;
        const today = new Date();
        const endDate = format(today, "yyyy-MM-dd");
        const startDate = format(subDays(today, days), "yyyy-MM-dd");
        const { channelId } = storedTokens;

        const [videoData, dailyData, db] = await Promise.all([
          getVideoAnalytics(token, channelId, videoId, startDate, endDate),
          getChannelDailyMetrics(token, channelId, startDate, endDate),
          getDb(),
        ]);

        const historyRows = await db.select<ThumbnailHistoryEntry[]>(
          "SELECT * FROM yt_thumbnail_history WHERE videoId = ? ORDER BY uploadedAt DESC",
          [videoId]
        );

        if (!cancelled) {
          setAnalytics(videoData);
          setDailyMetrics(dailyData);
          setThumbnailHistory(historyRows);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load analytics"
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [videoId, dateRange]);

  if (!videoId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-50 flex h-full w-[400px] flex-col border-border border-l bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-border border-b px-5 py-4">
          <h2 className="font-semibold text-base text-foreground">Analytics</h2>
          <button
            aria-label="Close analytics panel"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
          {/* Date range buttons */}
          <div className="flex gap-2">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                className={cn(
                  "rounded-full px-3.5 py-1.5 font-medium text-sm transition-colors",
                  dateRange === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                type="button"
              >
                {opt.label}
              </button>
            ))}
          </div>

          {isLoading && (
            <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground text-sm">
              Loading analytics...
            </div>
          )}

          {error && !isLoading && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-destructive text-sm">
              {error}
            </div>
          )}

          {!(isLoading || error) && analytics && (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Views"
                  value={analytics.views.toLocaleString()}
                />
                <StatCard
                  label="Impressions"
                  value={analytics.impressions.toLocaleString()}
                />
                <StatCard
                  label="CTR"
                  value={`${(analytics.impressionsCtr * 100).toFixed(1)}%`}
                />
                <StatCard
                  label="Avg View Duration"
                  value={formatDuration(analytics.averageViewDuration)}
                />
              </div>

              {/* Chart */}
              {dailyMetrics.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <ResponsiveContainer height={160} width="100%">
                    <AreaChart
                      data={dailyMetrics}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="colorViews"
                          x1="0"
                          x2="0"
                          y1="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="colorImpressions"
                          x1="0"
                          x2="0"
                          y1="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--muted-foreground))"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--muted-foreground))"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        axisLine={false}
                        dataKey="day"
                        interval="preserveStartEnd"
                        tick={{
                          fontSize: 10,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                        tickFormatter={(v: string) => {
                          const d = new Date(v);
                          return format(d, "MMM d");
                        }}
                        tickLine={false}
                      />
                      <YAxis
                        axisLine={false}
                        tick={{
                          fontSize: 10,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                        tickFormatter={(v: number) =>
                          v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                        }
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "hsl(var(--foreground))",
                        }}
                        labelFormatter={(label: string) => {
                          const d = new Date(label);
                          return format(d, "MMM d, yyyy");
                        }}
                      />
                      <Area
                        dataKey="impressions"
                        fill="url(#colorImpressions)"
                        name="Impressions"
                        stroke="hsl(var(--muted-foreground))"
                        strokeOpacity={0.5}
                        strokeWidth={1.5}
                        type="monotone"
                      />
                      <Area
                        dataKey="views"
                        fill="url(#colorViews)"
                        name="Views"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        type="monotone"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Thumbnail History */}
              <div className="flex flex-col gap-3">
                <h3 className="font-medium text-foreground text-sm">
                  Thumbnail History
                </h3>
                {thumbnailHistory.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No thumbnail uploads tracked yet
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {thumbnailHistory.map((entry) => (
                      <div
                        className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3"
                        key={entry.id}
                      >
                        {entry.thumbnailUrl ? (
                          <img
                            alt="Thumbnail"
                            className="h-14 w-24 shrink-0 rounded-md object-cover"
                            src={entry.thumbnailUrl}
                          />
                        ) : (
                          <div className="h-14 w-24 shrink-0 rounded-md bg-muted" />
                        )}
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="text-muted-foreground text-xs">
                            {format(new Date(entry.uploadedAt), "MMM d, yyyy")}
                          </span>
                          {entry.projectId && (
                            <span className="text-primary text-xs">
                              Uploaded from project
                            </span>
                          )}
                          {entry.note && (
                            <span className="line-clamp-2 text-foreground text-xs">
                              {entry.note}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/30 p-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold text-foreground text-lg">{value}</span>
    </div>
  );
}
