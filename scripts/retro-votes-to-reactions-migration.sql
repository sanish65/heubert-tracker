-- ── Migrate existing 👍 votes into the reactions table ────────────────────────
-- Run this once, after retro-reactions-schema.sql has already been applied.
-- Ports every row in retro_card_votes into retro_card_reactions as a 👍 reaction,
-- so historical votes show up as reactions in the new UI.

insert into retro_card_reactions (card_id, session_id, participant_name, emoji, created_at)
select v.card_id, v.session_id, v.participant_name, '👍', v.created_at
from retro_card_votes v
on conflict (card_id, participant_name, emoji) do nothing;
