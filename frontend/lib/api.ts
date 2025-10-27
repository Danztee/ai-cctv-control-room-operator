const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export interface EventConfig {
  event_code: string;
  event_description: string;
  detection_guidelines: string;
}

export interface AppConfig {
  model: string;
  rtsp_url: string;
  chunk_duration: number;
  context: string;
  events: EventConfig[];
}

export interface EventLog {
  event_id: number;
  event_timestamp: string;
  event_code: string;
  event_description: string;
  event_video_url: string;
  event_detection_explanation_by_ai: string;
}

export interface ServiceStatus {
  service_active: boolean;
  queue_info: {
    video_chunks_queue_size: number;
    event_detection_queue_size: number;
  };
  stream_url?: string;
}

// API Functions
export async function startMonitoring(
  config: AppConfig
): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error("Failed to start monitoring");
  return response.json();
}

export async function stopMonitoring(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/stop`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to stop monitoring");
  return response.json();
}

export async function getStatus(): Promise<ServiceStatus> {
  const response = await fetch(`${API_BASE_URL}/status`);
  if (!response.ok) throw new Error("Failed to get status");
  return response.json();
}

export async function getEvents(limit: number = 100): Promise<EventLog[]> {
  const response = await fetch(`${API_BASE_URL}/events?limit=${limit}`);
  if (!response.ok) throw new Error("Failed to get events");
  const data = await response.json();
  return data.events;
}

export async function getEvent(eventId: number): Promise<EventLog> {
  const response = await fetch(`${API_BASE_URL}/events/${eventId}`);
  if (!response.ok) throw new Error("Failed to get event");
  return response.json();
}

export function getVideoUrl(filepath: string): string {
  return `${API_BASE_URL}/video?filepath=${encodeURIComponent(filepath)}`;
}
