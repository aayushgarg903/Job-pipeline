-- Always safe to re-run. Indexes drizzle-kit can't express.
set search_path to ks, public, extensions;
create index if not exists skill_label_trgm on ks.skill using gin (label_en extensions.gin_trgm_ops);
create index if not exists skill_alias_trgm on ks.skill_alias using gin (alias extensions.gin_trgm_ops);
create index if not exists geo_alias_trgm on ks.geo_alias using gin (alias extensions.gin_trgm_ops);
create index if not exists skill_embedding_hnsw on ks.skill using hnsw (embedding extensions.vector_cosine_ops);
