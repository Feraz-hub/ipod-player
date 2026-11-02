export type Media = {
  id: string;
  kind: "music" | "clip";
  title: string;
  artist: string;
  duration: number;
  cover?: string;
  size: number;
  mime: string;
  blob?: Blob;
  local?: boolean;
  demo?: boolean;
  scene?: number;
  owner_id?: string;
  category?: string;
  source?: string;
  permission?: string;
  status?: string;
  created_at?: string;
  rights_confirmed?: boolean;
  externalUrl?: string;
};
export type Usage = {
  used: number;
  cap: number;
  egress: number;
  egressCap: number;
};
