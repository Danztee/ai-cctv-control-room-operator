"use server";

import { API_BASE_URL } from "@/constants";

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
  const response = await fetch(`${API_BASE_URL}/events/id/${eventId}`);
  if (!response.ok) throw new Error("Failed to get event");
  return response.json();
}

export async function getVideoUrl(filepath: string): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/video?filepath=${encodeURIComponent(filepath)}`
  );
  if (!response.ok) throw new Error("Failed to get video URL");
  return response.json();
}
