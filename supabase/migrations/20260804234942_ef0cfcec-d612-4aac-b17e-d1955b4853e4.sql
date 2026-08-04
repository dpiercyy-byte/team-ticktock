CREATE TABLE public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.ledger_jobs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to text,
  due_at timestamptz,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'Not Started',
  priority text NOT NULL DEFAULT 'Normal',
  trade text,
  task_type text NOT NULL DEFAULT 'general',
  dependency_task_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  template_key text,
  template_item_key text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_tasks_status_check CHECK (status IN ('Not Started','In Progress','Blocked','Completed','Cancelled')),
  CONSTRAINT project_tasks_priority_check CHECK (priority IN ('Low','Normal','High','Urgent'))
);

CREATE INDEX project_tasks_project_idx ON public.project_tasks(project_id);
CREATE INDEX project_tasks_due_idx ON public.project_tasks(due_at);
CREATE UNIQUE INDEX project_tasks_template_item_uidx
  ON public.project_tasks(project_id, template_key, template_item_key)
  WHERE template_key IS NOT NULL AND template_item_key IS NOT NULL;

GRANT ALL ON public.project_tasks TO service_role;

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_tasks deny all" ON public.project_tasks
  FOR ALL USING (false) WITH CHECK (false);

CREATE TRIGGER project_tasks_touch_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.os_touch_updated_at();