interface EventConfig {
  event_code: string;
  event_description: string;
  detection_guidelines: string;
}

interface AppConfig {
  model: string;
  rtsp_url: string;
  chunk_duration: number;
  context: string;
  events: EventConfig[];
}

interface EventLog {
  event_id: number;
  event_timestamp: string;
  event_code: string;
  event_description: string;
  event_video_url: string;
  event_detection_explanation_by_ai: string;
}

interface ServiceStatus {
  service_active: boolean;
  queue_info: {
    video_chunks_queue_size: number;
    event_detection_queue_size: number;
  };
  stream_url?: string;
}
