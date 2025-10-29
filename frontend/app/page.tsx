"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getStatus, startMonitoring, stopMonitoring } from "@/app/actions";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Page() {
  const router = useRouter();
  const [serviceActive, setServiceActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const [config, setConfig] = useState<AppConfig>({
    model: "gemini-2.5-flash",
    rtsp_url: "http://192.168.1.210:8080/video",
    chunk_duration: 5,
    context:
      "These frames are from a phone camera in a room. The camera may capture people, objects, movement, and various activities.",
    events: [
      {
        event_code: "person-detected",
        event_description: "A person is visible in the camera frame",
        detection_guidelines:
          "Detect if one or more people are visible in any of the video frames",
      },
      {
        event_code: "motion-activity",
        event_description: "Significant motion or activity detected",
        detection_guidelines:
          "Detect noticeable movement, changes in the scene, or any activity between frames",
      },
    ],
  });

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const status = await getStatus();
      setServiceActive(status.service_active);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      await startMonitoring(config);
      toast.success("Monitoring started successfully! Redirecting...");
      await fetchStatus();
      // Redirect to live monitoring page after a short delay
      setTimeout(() => {
        router.push("/live");
      }, 500);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start monitoring"
      );
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await stopMonitoring();
      toast.success("Monitoring stopped successfully!");
      fetchStatus();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to stop monitoring"
      );
    } finally {
      setLoading(false);
    }
  };

  const addEvent = () => {
    setConfig({
      ...config,
      events: [
        ...config.events,
        {
          event_code: `EVT${String(config.events.length + 1).padStart(3, "0")}`,
          event_description: "",
          detection_guidelines: "",
        },
      ],
    });
  };

  const removeEvent = (index: number) => {
    setConfig({
      ...config,
      events: config.events.filter((_, i) => i !== index),
    });
  };

  const updateEvent = (index: number, field: string, value: string) => {
    const newEvents = [...config.events];
    newEvents[index] = { ...newEvents[index], [field]: value };
    setConfig({ ...config, events: newEvents });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form className="space-y-6">
          {/* Top Row - Basic Settings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Settings */}
            <Card>
              <CardHeader>
                <CardTitle>AI Settings</CardTitle>
                <CardDescription>AI model & configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="model">AI Model</Label>
                  <Select
                    value={config.model}
                    onValueChange={(value) =>
                      setConfig({ ...config, model: value })
                    }
                  >
                    <SelectTrigger id="model">
                      <SelectValue placeholder="Select AI model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-2.5-pro">
                        Gemini 2.5 Pro
                      </SelectItem>
                      <SelectItem value="gemini-2.5-flash">
                        Gemini 2.5 Flash
                      </SelectItem>
                      <SelectItem value="gemini-2.5-flash-lite">
                        Gemini 2.5 Flash Lite
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="context">Context</Label>
                  <Textarea
                    id="context"
                    value={config.context}
                    onChange={(e) =>
                      setConfig({ ...config, context: e.target.value })
                    }
                    rows={4}
                    placeholder="Describe the location, time, and relevant context..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Stream Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Stream Settings</CardTitle>
                <CardDescription>Camera & processing config</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rtsp-url">RTSP Stream URL</Label>
                  <Input
                    id="rtsp-url"
                    type="text"
                    value={config.rtsp_url}
                    onChange={(e) =>
                      setConfig({ ...config, rtsp_url: e.target.value })
                    }
                    placeholder="rtsp://username:password@camera-ip:port/stream"
                  />
                  <p className="text-xs text-muted-foreground">
                    URL of your CCTV camera stream
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chunk-duration">
                    Chunk Duration (seconds)
                  </Label>
                  <Input
                    id="chunk-duration"
                    type="number"
                    value={config.chunk_duration}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        chunk_duration: parseInt(e.target.value),
                      })
                    }
                    min="1"
                    max="60"
                  />
                  <p className="text-xs text-muted-foreground">
                    How long each video chunk should be
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
          {/* End Top Row */}

          {/* Events Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Events to Detect</CardTitle>
                  <CardDescription>
                    Define event types for AI detection
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  onClick={addEvent}
                  variant="default"
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Event
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.events.map((event, index) => (
                <Card key={index} className="bg-muted/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        Event #{index + 1}
                      </CardTitle>
                      {config.events.length > 1 && (
                        <Button
                          type="button"
                          onClick={() => removeEvent(index)}
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`event-code-${index}`}>Event Code</Label>
                      <Input
                        id={`event-code-${index}`}
                        type="text"
                        value={event.event_code}
                        onChange={(e) =>
                          updateEvent(index, "event_code", e.target.value)
                        }
                        placeholder="EVT001"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`event-description-${index}`}>
                        Event Description
                      </Label>
                      <Input
                        id={`event-description-${index}`}
                        type="text"
                        value={event.event_description}
                        onChange={(e) =>
                          updateEvent(
                            index,
                            "event_description",
                            e.target.value
                          )
                        }
                        placeholder="Unauthorized Access"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`detection-guidelines-${index}`}>
                        Detection Guidelines
                      </Label>
                      <Textarea
                        id={`detection-guidelines-${index}`}
                        value={event.detection_guidelines}
                        onChange={(e) =>
                          updateEvent(
                            index,
                            "detection_guidelines",
                            e.target.value
                          )
                        }
                        rows={2}
                        placeholder="Describe what the AI should look for..."
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4">
            {!serviceActive ? (
              <Button
                type="button"
                onClick={handleStart}
                disabled={loading || !config.rtsp_url}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? "Starting..." : "Start Monitoring"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleStop}
                disabled={loading}
                variant="destructive"
              >
                {loading ? "Stopping..." : "Stop Monitoring"}
              </Button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
