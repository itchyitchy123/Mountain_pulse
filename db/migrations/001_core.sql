BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE resorts (
  id text PRIMARY KEY,
  name text NOT NULL,
  state text NOT NULL,
  boundary geometry(MultiPolygon,4326),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mountain_entities (
  id text PRIMARY KEY,
  resort_id text NOT NULL REFERENCES resorts(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('lift','run','zone','parking','gate')),
  name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}',
  geometry geometry(Geometry,4326),
  UNIQUE (resort_id,entity_type,name),
  UNIQUE (id,resort_id)
);
CREATE INDEX mountain_entities_geometry_idx ON mountain_entities USING gist(geometry);

CREATE TABLE data_sources (
  id text PRIMARY KEY,
  label text NOT NULL,
  source_mode text NOT NULL CHECK (source_mode IN ('official','community','sensor','model','simulation')),
  default_ttl interval NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  health jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id text NOT NULL REFERENCES resorts(id) ON DELETE CASCADE,
  entity_id text,
  resource text NOT NULL,
  metric text,
  value jsonb NOT NULL,
  source_id text NOT NULL REFERENCES data_sources(id),
  source_event_id text,
  quality real NOT NULL CHECK (quality BETWEEN 0 AND 1),
  observed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  raw_object_key text,
  FOREIGN KEY (entity_id,resort_id) REFERENCES mountain_entities(id,resort_id) ON DELETE CASCADE,
  CHECK (expires_at > observed_at)
);
CREATE INDEX observations_current_idx ON observations(resort_id,resource,observed_at DESC);
CREATE INDEX observations_expiry_idx ON observations(expires_at);
CREATE UNIQUE INDEX observations_source_event_unique_idx ON observations(source_id,source_event_id,resort_id,COALESCE(entity_id,''),resource) WHERE source_event_id IS NOT NULL;

CREATE TABLE topology_nodes (
  id text PRIMARY KEY,
  resort_id text NOT NULL REFERENCES resorts(id) ON DELETE CASCADE,
  node_type text NOT NULL,
  point geometry(PointZ,4326) NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}',
  UNIQUE (id,resort_id)
);
CREATE INDEX topology_nodes_point_idx ON topology_nodes USING gist(point);

CREATE TABLE topology_edges (
  id text PRIMARY KEY,
  resort_id text NOT NULL REFERENCES resorts(id) ON DELETE CASCADE,
  from_node text NOT NULL,
  to_node text NOT NULL,
  edge_type text NOT NULL CHECK (edge_type IN ('run','lift','walk','gate')),
  difficulty smallint NOT NULL CHECK (difficulty BETWEEN 0 AND 5),
  expected_seconds integer NOT NULL CHECK (expected_seconds > 0),
  snowboard_flat boolean NOT NULL DEFAULT false,
  exposure text NOT NULL DEFAULT 'low' CHECK (exposure IN ('low','moderate','high')),
  requirements jsonb NOT NULL DEFAULT '[]',
  geometry geometry(LineStringZ,4326) NOT NULL,
  UNIQUE (id,resort_id),
  FOREIGN KEY (from_node,resort_id) REFERENCES topology_nodes(id,resort_id),
  FOREIGN KEY (to_node,resort_id) REFERENCES topology_nodes(id,resort_id)
);
CREATE INDEX topology_edges_geometry_idx ON topology_edges USING gist(geometry);
CREATE INDEX topology_edges_route_idx ON topology_edges(resort_id,from_node,to_node);

CREATE TABLE community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_hash text NOT NULL,
  resort_id text NOT NULL REFERENCES resorts(id) ON DELETE CASCADE,
  entity_id text,
  zone_name text NOT NULL,
  report_kind text NOT NULL CHECK (report_kind IN ('condition','parking','hazard')),
  payload jsonb NOT NULL,
  location_proof jsonb,
  observed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  moderation_state text NOT NULL DEFAULT 'pending' CHECK (moderation_state IN ('pending','published','rejected','expired')),
  CHECK (expires_at > observed_at),
  FOREIGN KEY (entity_id,resort_id) REFERENCES mountain_entities(id,resort_id)
);
CREATE INDEX community_reports_active_idx ON community_reports(resort_id,zone_name,expires_at);

CREATE TABLE report_cooldowns (
  reporter_hash text NOT NULL,
  resort_id text NOT NULL REFERENCES resorts(id) ON DELETE CASCADE,
  report_kind text NOT NULL CHECK (report_kind IN ('condition','parking')),
  last_received_at timestamptz NOT NULL,
  PRIMARY KEY (reporter_hash,resort_id,report_kind)
);
CREATE INDEX report_cooldowns_expiry_idx ON report_cooldowns(last_received_at);

CREATE TABLE route_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_session_hash text,
  resort_id text NOT NULL REFERENCES resorts(id),
  route_edge_ids jsonb NOT NULL,
  candidate_summary jsonb NOT NULL,
  features jsonb NOT NULL,
  confidence real CHECK (confidence BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE route_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid REFERENCES route_recommendations(id) ON DELETE SET NULL,
  resort_id text NOT NULL REFERENCES resorts(id),
  rating text NOT NULL CHECK (rating IN ('nailed','fine','missed')),
  predicted jsonb NOT NULL DEFAULT '{}',
  actual jsonb NOT NULL DEFAULT '{}',
  context jsonb NOT NULL DEFAULT '{}',
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE movement_cells (
  resort_id text NOT NULL REFERENCES resorts(id),
  topology_edge_id text NOT NULL,
  window_start timestamptz NOT NULL,
  device_count integer NOT NULL CHECK (device_count >= 0),
  median_seconds integer,
  p90_seconds integer,
  published boolean NOT NULL DEFAULT false,
  PRIMARY KEY (resort_id,topology_edge_id,window_start),
  FOREIGN KEY (topology_edge_id,resort_id) REFERENCES topology_edges(id,resort_id)
);

CREATE TABLE movement_samples (
  resort_id text NOT NULL,
  topology_edge_id text NOT NULL,
  window_start timestamptz NOT NULL,
  device_hash text NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 1 AND 7200),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (resort_id,topology_edge_id,window_start,device_hash),
  FOREIGN KEY (topology_edge_id,resort_id) REFERENCES topology_edges(id,resort_id) ON DELETE CASCADE,
  CHECK (expires_at > window_start)
);
CREATE INDEX movement_samples_expiry_idx ON movement_samples(expires_at);

COMMIT;
