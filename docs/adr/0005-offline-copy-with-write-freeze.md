# v1 copies data offline behind a write freeze

The on-prem side stops accepting writes, the database is copied with pg_dump/restore,
verified, and only then cut over. Real migrations often use DMS for near-zero downtime,
but Floci has no DMS and hand-built replication is a large project; an explicit freeze
is also the clearest thing to watch. Online replication is a stretch goal.
