-- Jira's Move: an issue filed in the wrong project can be moved to another one.
--
-- public.move_task_to_project does the whole move in one transaction:
--   * the issue gets the next number in the new project (HTT-12 becomes POR-31), and its
--     old key keeps working as a link through task_key_aliases;
--   * its status lands in the new project's first status of the same category
--     (tasks_workflow already does that for an issue arriving from elsewhere);
--   * its sprint, fix version and epic belong to the old project, so they're cleared, and
--     it goes to the bottom of the new project's backlog;
--   * its sub-tasks move with it; an epic moves alone and its issues leave the epic;
--   * comments, history, work logs, attachments, watchers and links follow it, as they
--     hang off the issue's id.
-- A sub-task can't move on its own (Jira's rule): its parent moves, or it stays.
-- Who may move an issue: an admin, or whoever created it (the rule for deleting it).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Old keys
-- ─────────────────────────────────────────────────────────────────────────────

-- A number once handed out in a project is never handed out again (issue_seq only grows),
-- so an old key can point at the moved issue for good.
CREATE TABLE IF NOT EXISTS public.task_key_aliases (
  project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  task_id BIGINT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, number)
);

CREATE INDEX IF NOT EXISTS task_key_aliases_task_idx ON public.task_key_aliases (task_id);

ALTER TABLE public.task_key_aliases ENABLE ROW LEVEL SECURITY;

-- Read by every employee, as issues are; written only by move_task_to_project.
DROP POLICY IF EXISTS "Employees read key aliases" ON public.task_key_aliases;
CREATE POLICY "Employees read key aliases" ON public.task_key_aliases
  FOR SELECT USING (public.app_is_active_employee());
REVOKE INSERT, UPDATE, DELETE ON public.task_key_aliases FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. The write trigger lets a move through
-- ─────────────────────────────────────────────────────────────────────────────

-- As in 20261019125521_jira_issues.sql, except that while move_task_to_project runs
-- (app.moving_task = 'on') an issue may change project, and then takes a new number.
CREATE OR REPLACE FUNCTION public.tasks_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  parent public.tasks;
  moving BOOLEAN := COALESCE(current_setting('app.moving_task', true), 'off') = 'on';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.project_id IS NOT NULL AND NEW.project_id IS DISTINCT FROM OLD.project_id THEN
      IF NOT moving THEN
        RAISE EXCEPTION 'An issue cannot move to another project';
      END IF;
      -- Numbered afresh below, in the new project.
      NEW.number := NULL;
    ELSIF OLD.number IS NOT NULL AND NEW.number IS DISTINCT FROM OLD.number THEN
      RAISE EXCEPTION 'Issue numbers cannot be changed';
    END IF;
    IF NEW.type IS DISTINCT FROM OLD.type THEN
      IF OLD.type = 'epic' AND EXISTS (SELECT 1 FROM public.tasks WHERE parent_id = OLD.id) THEN
        RAISE EXCEPTION 'Move the issues out of this epic before changing its type';
      END IF;
      IF NEW.type IN ('epic', 'subtask')
         AND EXISTS (SELECT 1 FROM public.tasks WHERE parent_id = OLD.id AND type = 'subtask') THEN
        RAISE EXCEPTION 'Remove this issue''s sub-tasks before changing its type';
      END IF;
    END IF;
    NEW.updated_at := now();
  END IF;

  -- A number is handed out the first time an issue has a project: on create, when a
  -- task from the first board is filed into one, or when it moves to another.
  IF NEW.project_id IS NOT NULL AND NEW.number IS NULL THEN
    UPDATE public.projects
    SET issue_seq = issue_seq + 1
    WHERE id = NEW.project_id
    RETURNING issue_seq INTO NEW.number;
    IF NEW.number IS NULL THEN
      RAISE EXCEPTION 'Project % does not exist', NEW.project_id;
    END IF;
  END IF;

  -- Hierarchy: epic > story / task / bug > sub-task. Epics live outside sprints, and a
  -- sub-task is always in its parent's sprint.
  IF NEW.type = 'epic' THEN
    IF NEW.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'An epic cannot have a parent';
    END IF;
    NEW.sprint_id := NULL;
  ELSIF NEW.parent_id IS NOT NULL THEN
    SELECT * INTO parent FROM public.tasks WHERE id = NEW.parent_id;
    IF parent.id IS NULL THEN
      RAISE EXCEPTION 'Parent issue not found';
    END IF;
    IF parent.project_id IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'The parent issue must be in the same project';
    END IF;
    IF NEW.type = 'subtask' THEN
      IF parent.type IN ('epic', 'subtask') THEN
        RAISE EXCEPTION 'A sub-task belongs under a story, task or bug';
      END IF;
      NEW.sprint_id := parent.sprint_id;
    ELSIF parent.type <> 'epic' THEN
      RAISE EXCEPTION 'Only an epic can be the parent of a %', NEW.type;
    END IF;
  ELSIF NEW.type = 'subtask' THEN
    RAISE EXCEPTION 'A sub-task needs a parent issue';
  END IF;

  IF NEW.sprint_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.task_sprints s
    WHERE s.id = NEW.sprint_id AND s.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'That sprint belongs to a different project';
  END IF;

  -- completed_at follows the Done column: stamped on the way in, kept while it stays,
  -- cleared when the issue is reopened. The burndown chart reads it.
  IF NEW.status = 'done' THEN
    IF TG_OP = 'UPDATE' AND OLD.status = 'done' THEN
      NEW.completed_at := COALESCE(OLD.completed_at, now());
    ELSE
      NEW.completed_at := now();
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. A move is not a status change
-- ─────────────────────────────────────────────────────────────────────────────

-- As in 20261022140055_task_workflows_filters.sql, except that an issue changing project
-- tells nobody its status moved: the new project's column for the same stage isn't news.
CREATE OR REPLACE FUNCTION public.tasks_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me public.employees := public.app_current_employee();
  w RECORD;
  status_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.task_watch(NEW.id, me.id);
    PERFORM private.task_watch(NEW.id, NEW.reporter_id);
    PERFORM private.task_watch(NEW.id, NEW.assignee_id);
    PERFORM private.task_notify(NEW.assignee_id, NEW.id, 'assigned', NEW.title);
    RETURN NULL;
  END IF;

  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id AND NEW.assignee_id IS NOT NULL THEN
    PERFORM private.task_watch(NEW.id, NEW.assignee_id);
    PERFORM private.task_notify(NEW.assignee_id, NEW.id, 'assigned', NEW.title);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id THEN
    SELECT name INTO status_name FROM public.task_statuses WHERE project_id = NEW.project_id AND key = NEW.status;
    FOR w IN SELECT employee_id FROM public.task_watchers WHERE task_id = NEW.id LOOP
      IF w.employee_id IS DISTINCT FROM NEW.assignee_id OR NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN
        PERFORM private.task_notify(w.employee_id, NEW.id, 'status', COALESCE(status_name, NEW.status));
      END IF;
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. The move
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns the issue's new key, e.g. "POR-31".
CREATE OR REPLACE FUNCTION public.move_task_to_project(p_task_id BIGINT, p_project_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t public.tasks;
  target public.projects;
  bottom INTEGER;
  new_number INTEGER;
BEGIN
  IF NOT public.app_is_active_employee() THEN
    RAISE EXCEPTION 'Only employees can move issues';
  END IF;

  SELECT * INTO t FROM public.tasks WHERE id = p_task_id FOR UPDATE;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Issue not found';
  END IF;
  IF NOT (public.app_is_admin() OR lower(t.created_by) = lower(auth.jwt() ->> 'email')) THEN
    RAISE EXCEPTION 'Only an admin or the person who created this issue can move it';
  END IF;
  IF t.project_id IS NULL THEN
    RAISE EXCEPTION 'File this task into a project first';
  END IF;
  IF t.type = 'subtask' THEN
    RAISE EXCEPTION 'A sub-task moves with its parent issue';
  END IF;

  SELECT * INTO target FROM public.projects WHERE id = p_project_id;
  IF target.id IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  IF target.id = t.project_id THEN
    RAISE EXCEPTION 'The issue is already in %', target.name;
  END IF;
  IF target.issue_key IS NULL THEN
    RAISE EXCEPTION '% has no issue key yet', target.name;
  END IF;
  IF target.status = 'archived' THEN
    RAISE EXCEPTION '% is archived', target.name;
  END IF;

  -- Out of the old project's plan first, while everything is still there: an epic lets go
  -- of its issues, and leaving the sprint takes the sub-tasks out with it
  -- (tasks_after_write), so no row is ever checked against a parent in the other project.
  IF t.type = 'epic' THEN
    UPDATE public.tasks SET parent_id = NULL WHERE parent_id = t.id AND type <> 'subtask';
  END IF;
  UPDATE public.tasks SET sprint_id = NULL, fix_version_id = NULL
  WHERE id = t.id AND (sprint_id IS NOT NULL OR fix_version_id IS NOT NULL);

  -- Old keys keep working as links.
  INSERT INTO public.task_key_aliases (project_id, number, task_id)
  SELECT project_id, number, id FROM public.tasks
  WHERE (id = t.id OR (parent_id = t.id AND type = 'subtask')) AND number IS NOT NULL
  ON CONFLICT (project_id, number) DO UPDATE SET task_id = EXCLUDED.task_id;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO bottom
  FROM public.tasks WHERE project_id = target.id AND sprint_id IS NULL;

  PERFORM set_config('app.moving_task', 'on', true);
  UPDATE public.tasks
  SET project_id = target.id,
      -- An epic has no parent, and a story's epic is in the old project.
      parent_id = NULL,
      sort_order = bottom
  WHERE id = t.id
  RETURNING number INTO new_number;
  UPDATE public.tasks
  SET project_id = target.id, fix_version_id = NULL
  WHERE parent_id = t.id AND type = 'subtask';
  PERFORM set_config('app.moving_task', 'off', true);

  RETURN target.issue_key || '-' || new_number;
END;
$$;

-- No REVOKE EXECUTE here: in this Postgres build calling a function without EXECUTE
-- crashes the server process (see 20261021170648_jira_more.sql). The checks at the top
-- of the function keep out anyone who isn't an active employee.
