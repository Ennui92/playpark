// Domain types — mirror the Supabase schema (see supabase/migrations/0001_init.sql).

export type LandmarkCategory =
  | "playground"
  | "park"
  | "splash_pad"         // still in DB for legacy rows; no longer in UI
  | "library"
  | "indoor_play"
  | "cafe"
  | "community_center"
  | "square"             // public plazas (Berlin "Platz") — gathering spots
  | "flea_market"        // Trödelmarkt, Flohmarkt, weekly markets
  | "event"              // a place known for hosting events / event venue
  | "other";

export interface Family {
  id: string;
  name: string;
  zip: string;
  avatar_url: string | null;
  created_at: string;
}

export interface AppUser {
  id: string;           // auth.users.id
  family_id: string;
  display_name: string;
  username: string;
  push_token: string | null;
  created_at: string;
}

export interface Kid {
  id: string;
  family_id: string;
  name: string;
  birth_year: number;
  birth_month: number;
  emoji: string | null;
  created_at: string;
}

export interface Landmark {
  id: string;
  name: string;
  zip: string;
  category: LandmarkCategory;
  emoji: string;
  lat: number;
  lng: number;
  created_by_family_id?: string | null;
}

export interface Broadcast {
  id: string;
  family_id: string;
  landmark_id: string;
  planned_at: string;
  message: string | null;
  kid_ids: string[];
  created_at: string;
  expires_at: string;
  ended_at: string | null;
}

// Enriched broadcast (join of broadcast + family + landmark) for list rendering.
export interface BroadcastFeedItem extends Broadcast {
  family_name: string;
  family_avatar_url: string | null;
  landmark_name: string;
  landmark_emoji: string;
}

// ─── Navigation ───────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
  Landmark: { landmarkId: string };
  BroadcastCompose: { landmarkId: string };
  BroadcastSuccess: {
    landmarkName: string;
    landmarkEmoji: string;
    audienceCount: number;
  };
  AddLandmark: undefined;
  EditNeighborhood: undefined;
  QRShare: undefined;
  QRScan: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Friends: undefined;
  Me: undefined;
};
