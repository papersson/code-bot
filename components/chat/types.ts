export interface EphemeralMessage {
    id?: number;
    tempId?: string;
    sender: "user" | "bot";
    content: string;
    createdAt: Date;
    pending?: boolean;
  }
  