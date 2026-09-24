-- Always safe to re-run.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create schema if not exists ks;
