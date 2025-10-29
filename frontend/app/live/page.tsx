"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getEvents,
  EventLog,
  getVideoUrl,
  stopMonitoring,
  getStatus,
  API_BASE_URL,
} from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  RefreshCw,
  StopCircle,
  Pause,
  Play,
  Radio,
  Video,
  Inbox,
} from "lucide-react";

export default function LiveMonitoringPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceActive, setServiceActive] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventLog | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [streamUrl, setStreamUrl] = useState<string | undefined>(undefined);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await getStatus();
      setServiceActive(status.service_active);

      console.log(status, "status....");
      setStreamUrl((status as unknown as { stream_url?: string }).stream_url);
      // stream_url kept on backend; no frontend fallback usage
      if (!status.service_active) {
        // If service stopped, redirect to home
        router.push("/");
      }
    } catch (err) {
      console.error(err);
    }
  }, [router]);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await getEvents(50); // Get most recent 50 events
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchEvents();
  }, [fetchStatus, fetchEvents]);

  useEffect(() => {
    if (!autoRefresh || !serviceActive) return;

    const interval = setInterval(() => {
      fetchEvents();
      fetchStatus();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, serviceActive, fetchEvents, fetchStatus]);

  // WebRTC removed: using direct MJPEG stream via <img>

  const handleStop = async () => {
    setStopLoading(true);
    try {
      await stopMonitoring();
      toast.success("Monitoring stopped successfully!");
      setTimeout(() => {
        router.push("/");
      }, 1000);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to stop monitoring");
    } finally {
      setStopLoading(false);
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return formatDate(timestamp);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading live feed...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-background flex flex-col pb-4">
      {/* Header */}
      <Card className="rounded-none border-x-0 border-t-0 shadow-sm">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">Live Monitoring</h1>
                  <Badge className="animate-pulse gap-1 bg-green-600 hover:bg-green-600 text-white">
                    <Radio className="h-3 w-3" />
                    Active
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Real-time event detection and monitoring
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="mr-3">API: {API_BASE_URL || "(unset)"}</span>
                  <span>Service: {serviceActive ? "active" : "inactive"}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                  id="auto-refresh"
                />
                <Label htmlFor="auto-refresh" className="cursor-pointer">
                  {autoRefresh ? (
                    <span className="flex items-center gap-1 text-sm">
                      <Play className="h-3 w-3" /> Auto-refresh
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm">
                      <Pause className="h-3 w-3" /> Paused
                    </span>
                  )}
                </Label>
              </div>
              <Button
                onClick={handleStop}
                disabled={stopLoading}
                variant="destructive"
                size="lg"
              >
                <StopCircle className="h-4 w-4" />
                {stopLoading ? "Stopping..." : "Stop Monitoring"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - Split Layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Live Feed Area - Left Side */}
        <div className="flex-1 flex flex-col">
          <Card className="rounded-none border-x-0 border-b-0 border-r">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Live Feed</CardTitle>
                <Button
                  onClick={() => fetchEvents()}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Video Display Area */}
              <div className="bg-black rounded-lg aspect-video flex items-center justify-center overflow-hidden">
                {selectedEvent ? (
                  <video
                    src={getVideoUrl(selectedEvent.event_video_url)}
                    controls
                    className="w-full h-full object-contain rounded-lg"
                    autoPlay
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : streamUrl ? (
                  // MJPEG/HTTP fallback when WebRTC is unavailable
                  <img
                    key="mjpeg"
                    src={streamUrl}
                    alt="Live stream"
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2 font-medium">
                      Connecting to live feed...
                    </p>
                    <p className="text-sm">
                      Waiting for camera stream to start
                    </p>
                  </div>
                )}
              </div>

              {/* Event Details */}
              {selectedEvent && (
                <Card className="bg-muted">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="gap-1">
                        {selectedEvent.event_code}
                      </Badge>
                      <CardDescription>
                        {formatTimeAgo(selectedEvent.event_timestamp)}
                      </CardDescription>
                    </div>
                    <CardTitle className="text-lg mt-2">
                      {selectedEvent.event_description}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      <span className="font-medium">AI Explanation:</span>{" "}
                      {selectedEvent.event_detection_explanation_by_ai}
                    </p>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Events Sidebar - Right Side */}
        <div className="w-96 flex flex-col overflow-hidden">
          <Card className="rounded-none border-x-0 border-t-0 border-b-0 flex flex-col flex-1">
            <CardHeader className="border-b">
              <CardTitle>Detected Events</CardTitle>
              <CardDescription>
                {events.length} event{events.length !== 1 ? "s" : ""} detected
              </CardDescription>
            </CardHeader>

            <ScrollArea className="flex-1">
              <div className="p-0">
                {events.length === 0 ? (
                  <div className="p-6 text-center">
                    <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground font-medium">
                      No events detected yet
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Events will appear here automatically
                    </p>
                  </div>
                ) : (
                  <div>
                    {events.map((event, index) => (
                      <div key={event.event_id}>
                        <div
                          className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedEvent?.event_id === event.event_id
                              ? "bg-accent"
                              : ""
                          }`}
                          onClick={() => setSelectedEvent(event)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-destructive rounded-full mt-1.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <Badge
                                  variant="destructive"
                                  className="text-xs gap-1"
                                >
                                  {event.event_code}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatTimeAgo(event.event_timestamp)}
                                </span>
                              </div>
                              <h3 className="font-semibold text-sm mb-1 truncate">
                                {event.event_description}
                              </h3>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {event.event_detection_explanation_by_ai}
                              </p>
                            </div>
                          </div>
                        </div>
                        {index < events.length - 1 && <Separator />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </main>
    </div>
  );
}
