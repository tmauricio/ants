export interface RepoEntry {
  id: string;
  name: string;
  path: string;
}

export interface GraphRow {
  oid: string;
  short_oid: string;
  summary: string;
  author_name: string;
  author_email: string;
  author_time: number; // unix seconds
  is_merge: boolean;
  lane: number;
  color: string;
  num_lanes: number;
  edges: [number, number, number][]; // [from_lane, to_lane, color_idx]
  refs: string[];
}

export interface BranchInfo {
  name: string;
  is_head: boolean;
  upstream: string | null;
  tip_oid: string;
}

export interface RemoteInfo {
  name: string;
  url: string;
}

export interface TagInfo {
  name: string;
  oid: string;
}

export interface StashInfo {
  index: number;
  message: string;
  oid: string;
}

export interface StatusEntry {
  path: string;
  status: string;
  staged: boolean;
}

export interface FileDiff {
  path: string;
  old_path: string | null;
  status: string;
  additions: number;
  deletions: number;
  patch: string;
}

export interface CommitDetail {
  oid: string;
  short_oid: string;
  summary: string;
  body: string;
  author_name: string;
  author_email: string;
  author_time: number;
  committer_name: string;
  committer_time: number;
  parents: string[];
  files: FileDiff[];
}

export const LANE_COLORS = [
  "#5cb6f8", "#f9c74f", "#90be6d", "#f8961e",
  "#c77dff", "#43aa8b", "#f94144", "#ff9f1c",
  "#4cc9f0", "#f72585",
];
