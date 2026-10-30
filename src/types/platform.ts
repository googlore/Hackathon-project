export type RoomRole = "host" | "participant";
export type RoomStatus = "open" | "closed";
export type ChallengeStatus = "open" | "upheld" | "rejected";

export interface RoomSummary {
  id: string;
  code: string;
  name: string;
  subject: string | null;
  topic: string | null;
  status: RoomStatus;
  role: RoomRole;
}

export interface RoomMember {
  userId: string;
  displayName: string;
  role: RoomRole;
}

export interface Defence {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface Challenge {
  id: string;
  authorId: string;
  authorName: string;
  claim: string;
  correction: string | null;
  verification: string | null;
  status: ChallengeStatus;
  createdAt: string;
  defences: Defence[];
}

export interface SolutionStep {
  id: string;
  position: number;
  content: string;
  challenges: Challenge[];
}

export interface ArenaCase {
  id: string;
  authorId: string;
  authorName: string;
  prompt: string;
  source: string | null;
  status: "open" | "closed";
  createdAt: string;
  steps: SolutionStep[];
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  role: RoomRole;
  points: number;
}

export interface RoomState extends RoomSummary {
  members: RoomMember[];
  cases: ArenaCase[];
  leaderboard: LeaderboardEntry[];
}

export interface GuestSession {
  user: { id: string };
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface CreateRoomRequest {
  name: string;
  displayName: string;
  subject?: string;
  topic?: string;
}

export interface JoinRoomRequest {
  code: string;
  displayName: string;
}

export interface CreateCaseRequest {
  prompt: string;
  source?: string;
  steps: Array<{ content: string }>;
}

export interface CreateChallengeRequest {
  claim: string;
  correction?: string;
  verification?: string;
}

export interface CreateDefenceRequest {
  body: string;
}

export interface SettleChallengeRequest {
  verdict: "upheld" | "rejected";
}
