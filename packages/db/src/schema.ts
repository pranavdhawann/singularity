export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'project',
    root_path TEXT,
    privacy_mode TEXT NOT NULL DEFAULT 'standard',
    default_model_profile_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS workspace_labels (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    type TEXT NOT NULL,
    actor TEXT NOT NULL,
    title TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    privacy_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS events_workspace_created_idx
    ON events (workspace_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS event_sources (
    event_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    range_json TEXT,
    PRIMARY KEY (event_id, source_type, source_id)
  )`,
  `CREATE TABLE IF NOT EXISTS timeline_labels (
    event_id TEXT NOT NULL,
    label_id TEXT NOT NULL,
    PRIMARY KEY (event_id, label_id)
  )`,
  `CREATE TABLE IF NOT EXISTS imports (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    source_path TEXT,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    error_message TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    import_id TEXT,
    title TEXT NOT NULL,
    source_uri TEXT NOT NULL,
    media_type TEXT NOT NULL,
    hash TEXT NOT NULL,
    text_path TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    source_range_json TEXT,
    embedding_status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  )`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks_fts
    USING fts5(chunk_id UNINDEXED, title, text)`,
  `CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    type TEXT NOT NULL,
    statement TEXT NOT NULL,
    summary TEXT,
    confidence REAL NOT NULL,
    scope_json TEXT NOT NULL,
    privacy_json TEXT NOT NULL,
    review_state TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    outdated_at TEXT,
    last_confirmed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS memory_sources (
    memory_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    range_json TEXT,
    PRIMARY KEY (memory_id, source_type, source_id)
  )`,
  `CREATE TABLE IF NOT EXISTS memory_revisions (
    id TEXT PRIMARY KEY,
    memory_id TEXT NOT NULL,
    previous_json TEXT NOT NULL,
    next_json TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS compactions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    summary TEXT NOT NULL,
    source_event_ids TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    display_name TEXT NOT NULL,
    base_url TEXT,
    api_key_ref TEXT,
    is_local INTEGER NOT NULL,
    capabilities_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS model_profiles (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    name TEXT NOT NULL,
    model TEXT NOT NULL,
    context_window INTEGER NOT NULL,
    purpose TEXT NOT NULL,
    temperature REAL,
    privacy_policy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS model_calls (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    model_profile_id TEXT,
    context_pack_id TEXT,
    status TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    error_message TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS permission_rules (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    capability TEXT NOT NULL,
    state TEXT NOT NULL,
    scope_json TEXT NOT NULL,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS permission_requests (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    capability TEXT NOT NULL,
    reason TEXT NOT NULL,
    data_access_json TEXT NOT NULL,
    decision TEXT,
    created_at TEXT NOT NULL,
    decided_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS context_packs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    command_event_id TEXT,
    model_profile_id TEXT,
    budget_json TEXT NOT NULL,
    items_json TEXT NOT NULL,
    redactions_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS retrieval_runs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    query TEXT NOT NULL,
    strategy TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    input_json TEXT NOT NULL,
    result_json TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT
  )`
] as const;
