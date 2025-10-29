/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getEvents,
  getVideoUrl,
  stopMonitoring,
  getStatus,
} from "@/app/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardDescription } from "@/components/ui/card";
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
import { API_BASE_URL } from "@/constants";

export default function LiveMonitoringPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceActive, setServiceActive] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventLog | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [streamUrl, setStreamUrl] = useState<string | undefined>(undefined);
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [videoError, setVideoError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await getStatus();
      setServiceActive(status.service_active);
      setStreamUrl((status as unknown as { stream_url?: string }).stream_url);

      if (!status.service_active) {
        // router.push("/");
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await getEvents(50);

      console.log(data);
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
    let isCancelled = false;
    const run = async () => {
      if (selectedEvent?.event_video_url) {
        try {
          const src = await getVideoUrl(selectedEvent.event_video_url);
          if (!isCancelled) {
            setVideoSrc(src);
            setVideoError(null);
          }
        } catch {
          if (!isCancelled) {
            setVideoError("Failed to load video. Check the URL and server.");
            setVideoSrc(undefined);
          }
        }
      } else {
        setVideoSrc(undefined);
        setVideoError(null);
      }
    };
    run();
    return () => {
      isCancelled = true;
    };
  }, [selectedEvent]);

  useEffect(() => {
    if (!autoRefresh || !serviceActive) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const es = new EventSource(`${API_BASE_URL}/events/stream`);
    eventSourceRef.current = es;

    es.onmessage = (e: MessageEvent) => {
      try {
        const incoming = JSON.parse(e.data) as EventLog;
        setEvents((prev) => {
          const exists = prev.some((p) => p.event_id === incoming.event_id);
          const next = exists ? prev : [incoming, ...prev];
          return next.slice(0, 200);
        });
      } catch {}
    };

    es.onerror = () => {
      console.error("Error in SSE connection");
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [autoRefresh, serviceActive]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="p-8">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading live feed...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between sticky top-0 z-40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-b p-4">
        <div className="flex items-center gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Live Monitoring</h1>
              <Badge className="animate-pulse gap-1 bg-green-600 hover:bg-green-600 text-white">
                <Radio className="h-3 w-3" />
                Active
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              Real-time event detection and monitoring
            </p>

            <div className="text-xs text-muted-foreground">
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
      </header>

      <main className="grid grid-cols-4">
        <aside className="col-span-3">
          <div className="h-full flex flex-col">
            <div className="h-20 border-b px-4 py-3 flex items-center justify-between border-r">
              <h2 className="text-lg font-semibold">Live Feed</h2>

              <Button onClick={() => fetchEvents()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>

            <div className="space-y-4 p-4 border-r">
              <div className="bg-black rounded-lg aspect-video flex items-center justify-center overflow-hidden">
                {selectedEvent ? (
                  <div className="w-full h-full">
                    <video
                      key={selectedEvent.event_id}
                      src={videoSrc}
                      controls
                      className="w-full h-full object-contain rounded-lg"
                      autoPlay
                      preload="metadata"
                      onError={() =>
                        setVideoError(
                          "Failed to load video. Check the URL and server."
                        )
                      }
                    >
                      Your browser does not support the video tag.
                    </video>
                    <div className="text-xs text-muted-foreground px-1 py-1 flex items-center gap-2">
                      <span className="truncate">
                        {videoSrc || "(no video URL)"}
                      </span>
                      {videoSrc && (
                        <a
                          href={videoSrc}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          Open
                        </a>
                      )}
                      {videoError && (
                        <span className="text-red-500">{videoError}</span>
                      )}
                    </div>
                  </div>
                ) : streamUrl ? (
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

              {selectedEvent && (
                <div className="bg-muted rounded-lg p-4">
                  <div className="pb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="gap-1">
                        {selectedEvent.event_code}
                      </Badge>
                      <CardDescription>
                        {new Date(selectedEvent.event_timestamp).toLocaleString(
                          undefined,
                          {
                            dateStyle: "short",
                            timeStyle: "short",
                          }
                        )}
                      </CardDescription>
                    </div>
                    <h3 className="text-lg mt-2 font-semibold">
                      {selectedEvent.event_description}
                    </h3>
                  </div>
                  <div>
                    <p className="text-sm">
                      <span className="font-medium">AI Explanation:</span>{" "}
                      {selectedEvent.event_detection_explanation_by_ai}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        <aside className="col-span-1">
          <div className="flex flex-col flex-1">
            <div className="h-20 border-b px-4 py-3 flex flex-col">
              <h2 className="text-lg font-semibold">Detected Events</h2>

              <p className="text-sm text-muted-foreground">
                {events.length} event{events.length !== 1 ? "s" : ""} detected
              </p>
            </div>

            <ScrollArea className="flex-1 min-h-0">
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
                                  {new Date(
                                    event.event_timestamp
                                  ).toLocaleString(undefined, {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
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
          </div>
        </aside>
      </main>
    </div>
  );
}
