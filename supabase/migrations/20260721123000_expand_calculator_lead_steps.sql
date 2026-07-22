alter table public.lamy_calculator_leads
  drop constraint if exists lamy_calculator_leads_current_step_check;

alter table public.lamy_calculator_leads
  add constraint lamy_calculator_leads_current_step_check
  check (current_step between 1 and 4);
