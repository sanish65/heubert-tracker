-- RETRO: VOTED CARDS TICKED AS ACTION ITEMS
-- Apply manually via the Supabase SQL editor, AFTER scripts/retro-action-items-kudos-schema.sql.
-- Additive only.
--
-- Before ending a retro the facilitator ticks voted cards in the Top Voted view; each
-- ticked card becomes an action item that later boards of the project carry forward.
-- source_card_id is the card it came from.
--
-- Deliberately NOT a foreign key: edit_card in /api/retro deletes and re-inserts a card
-- under the same id, and a cascade would take the action item with it. Unique, so a card
-- becomes an action item at most once.
alter table retro_action_items add column if not exists source_card_id uuid;

create unique index if not exists retro_action_items_source_card_id_key
  on retro_action_items(source_card_id);

-- Verify (expect one row):
--   select column_name from information_schema.columns
--    where table_name = 'retro_action_items' and column_name = 'source_card_id';
