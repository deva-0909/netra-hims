-- Eye Bank deep-dive: enforce serology + expiry safety at allocation time, and
-- lock terminal tissue states (discarded/used), instead of relying on staff
-- diligence with a plain status dropdown.
--
-- Uses tg_op (not "old is not null") to distinguish insert vs update: for row
-- variables in a combined "before insert or update" trigger, "old is null"
-- does not reliably indicate an insert here, while tg_op always does.

create or replace function enforce_eye_bank_tissue_safety()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' and old.status in ('discarded', 'used') and new.status is distinct from old.status then
    raise exception 'Tissue % is already % and cannot be moved to another status.', old.tissue_number, old.status;
  end if;

  if new.status = 'allocated' and (tg_op = 'INSERT' or old.status is distinct from 'allocated') then
    if new.serology_hiv is distinct from 'non_reactive' or new.serology_hbsag is distinct from 'non_reactive' or new.serology_hcv is distinct from 'non_reactive' then
      raise exception 'Cannot allocate tissue % until HIV, HBsAg and HCV serology are all non-reactive.', new.tissue_number;
    end if;
    if new.expiry_date is not null and new.expiry_date < current_date then
      raise exception 'Cannot allocate tissue % — it expired on %.', new.tissue_number, new.expiry_date;
    end if;
  end if;

  return new;
end;
$function$;

create trigger trg_enforce_eye_bank_tissue_safety
before insert or update on eye_bank_tissues
for each row execute function enforce_eye_bank_tissue_safety();
