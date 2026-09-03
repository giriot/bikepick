-- ═══════════════════════════════════════════════════════════════════════════
-- CompareBike — 0002_functions_triggers.sql
-- Security-definer helpers, role protection, audit logging and
-- user-notification triggers. Run after 0001, before 0003 (RLS).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Role helpers (security definer so RLS can't hide the answer) ─────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select p.role = 'admin' from public.profiles p where p.id = auth.uid()
  ), false);
$$;

create or replace function public.is_dealer()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select d.status = 'approved' from public.dealer_profiles d where d.user_id = auth.uid()
  ), false);
$$;

create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select p.role from public.profiles p where p.id = auth.uid()
  ), 'anon');
$$;

-- grant_role('admin', 'owner@example.com') — the ONLY way to create an admin.
create or replace function public.grant_role(p_role text, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('admin', 'service_role')
     and current_setting('role', true) <> 'postgres'
  then
    raise exception 'Only an existing admin, the service role, or the project owner can grant roles.';
  end if;
  if p_role not in ('user', 'dealer', 'admin') then
    raise exception 'Invalid role %', p_role;
  end if;
  update public.profiles
     set role = p_role
   where lower(email) = lower(p_email);
  if not found then
    raise exception 'No user with email %', p_email;
  end if;
  insert into public.user_roles (user_id, role, granted_by)
  select p.id, p_role, auth.uid() from public.profiles p where lower(p.email) = lower(p_email);
end;
$$;

-- ─── Role protection: only admins may change roles ────────────────────────
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from coalesce(old.role, 'user')
     and public.is_admin() = false
  then
    raise exception 'Only an admin can change roles.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_profiles_protect_role on public.profiles;
create trigger trg_profiles_protect_role
  before update of role on public.profiles
  for each row execute function public.protect_profile_role();

-- ─── Audit log: every admin write is captured ─────────────────────────────
create or replace function public.audit_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec_id text;
begin
  if public.is_admin() = false then
    -- non-admin writes are not audit-logged (they are constrained by RLS anyway)
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'INSERT' then
    rec_id := coalesce(new.id::text, to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key');
    insert into public.admin_logs (admin_id, action, record_type, record_id, new_data)
    values (auth.uid(), 'insert', tg_table_name, rec_id, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    rec_id := coalesce(new.id::text, old.id::text, to_jsonb(old) ->> 'key');
    insert into public.admin_logs (admin_id, action, record_type, record_id, previous_data, new_data)
    values (auth.uid(), 'update', tg_table_name, rec_id, to_jsonb(old), to_jsonb(new));
    return new;
  else
    rec_id := coalesce(old.id::text, to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'key');
    insert into public.admin_logs (admin_id, action, record_type, record_id, previous_data)
    values (auth.uid(), 'delete', tg_table_name, rec_id, to_jsonb(old));
    return old;
  end if;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'brands','bike_models','bike_variants','bike_colours','bike_images',
    'specification_groups','specifications','bike_specifications',
    'bike_features','bike_pros','bike_cons','dealer_profiles','dealer_offers',
    'used_bikes','reviews','articles','faqs','seo_pages','site_settings','profiles'
  ]
  loop
    execute format('drop trigger if exists trg_%s_audit on public.%I', t, t);
    execute format('create trigger trg_%s_audit after insert or update or delete on public.%I for each row execute function public.audit_admin_change()', t, t);
  end loop;
end;
$$;

-- ─── Notifications (security definer so triggers bypass RLS on insert) ────
create or replace function public.notify_user(uid uuid, ntype text, ntitle text, nbody text default null, nlink text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if uid is null then return; end if;
  insert into public.notifications (user_id, type, title, body, link)
  values (uid, ntype, ntitle, nbody, nlink);
end;
$$;

-- dealer application / status changes
create or replace function public.on_dealer_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify_user(new.user_id, 'dealer_application',
      'Dealer application received',
      'Your dealer application is under review. We''ll notify you once it is verified.',
      '/dealer');
    -- notify all admins
    for rec in select id from public.profiles where role = 'admin'
    loop
      insert into public.notifications (user_id, type, title, body, link)
      values (rec.id, 'dealer_application', 'New dealer application',
              coalesce(new.dealer_name, 'A dealer') || ' applied for dealer verification.',
              '/admin/dealers');
    end loop;
    return new;
  end if;

  if new.status is distinct from old.status then
    case new.status
      when 'approved' then
        perform public.notify_user(new.user_id, 'dealer_status', 'Your dealership is verified ✓',
          'Your dealer profile is approved. You can now post offers on the bikes you represent.',
          '/dealer/offers');
      when 'rejected' then
        perform public.notify_user(new.user_id, 'dealer_status', 'Dealer application update',
          'Your dealer application could not be approved. Reason: ' || coalesce(new.reject_reason, 'not specified') ||
          '. You may fix the documents and resubmit.',
          '/dealer/register');
      when 'suspended' then
        perform public.notify_user(new.user_id, 'dealer_status', 'Dealer account suspended',
          'Your dealer account has been suspended. Reason: ' || coalesce(new.reject_reason, 'see admin contact'),
          '/dealer');
      when 'waiting' then
        perform public.notify_user(new.user_id, 'dealer_status', 'Application resubmitted',
          'Your dealer application has been re-submitted and is under review again.',
          '/dealer/register');
        for rec in select id from public.profiles where role = 'admin'
        loop
          insert into public.notifications (user_id, type, title, body, link)
          values (rec.id, 'dealer_application', 'Dealer resubmitted application',
                  coalesce(new.dealer_name, 'A dealer') || ' resubmitted their application.',
                  '/admin/dealers');
        end loop;
    end case;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_dealer_status on public.dealer_profiles;
create trigger trg_dealer_status
  after insert or update on public.dealer_profiles
  for each row execute function public.on_dealer_status_change();

-- dealer offers
create or replace function public.on_offer_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare duuid uuid;
begin
  if tg_op = 'INSERT' then
    select user_id into duuid from public.dealer_profiles where id = new.dealer_id;
    perform public.notify_user(duuid, 'offer_status', 'Offer submitted',
      'Your offer for ' || coalesce((select m.name from public.bike_models m where m.id = new.bike_model_id), 'a bike') ||
      ' is under review.',
      '/dealer/offers');
    for rec in select id from public.profiles where role = 'admin'
    loop
      insert into public.notifications (user_id, type, title, body, link)
      values (rec.id, 'offer_pending', 'New dealer offer to review',
              coalesce((select d.dealer_name from public.dealer_profiles d where d.id = new.dealer_id), 'A dealer') ||
              ' posted an offer for ' ||
              coalesce((select m.name from public.bike_models m where m.id = new.bike_model_id), 'a bike') || '.',
              '/admin/offers');
    end loop;
    return new;
  end if;

  if new.status is distinct from old.status then
    select user_id into duuid from public.dealer_profiles where id = new.dealer_id;
    if duuid is not null then
      case new.status
        when 'approved' then
          perform public.notify_user(duuid, 'offer_status', 'Offer approved ✓',
            'Your offer is now live on the bike page.',
            '/dealer/offers');
        when 'rejected' then
          perform public.notify_user(duuid, 'offer_status', 'Offer update',
            'Your offer was not approved. Reason: ' || coalesce(new.reject_reason, 'not specified') || '. You may correct it and resubmit.',
            '/dealer/offers');
      end case;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_offer_status on public.dealer_offers;
create trigger trg_offer_status
  after insert or update on public.dealer_offers
  for each row execute function public.on_offer_status_change();

-- used bike listings
create or replace function public.on_used_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare duuid uuid;
begin
  if tg_op = 'INSERT' then
    if new.status in ('submitted', 'waiting_approval') then
      perform public.notify_user(new.user_id, 'used_status', 'Listing submitted',
        'Your used bike listing has been submitted and is waiting for approval.',
        '/account/used');
      for rec in select id from public.profiles where role = 'admin'
      loop
        insert into public.notifications (user_id, type, title, body, link)
        values (rec.id, 'used_pending', 'Used bike to verify',
                coalesce(new.year::text, '') || ' ' || new.model_name || ' (' || coalesce(new.city, 'city n/a') || ') is awaiting approval.',
                '/admin/used');
      end loop;
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    case new.status
      when 'approved' then
        perform public.notify_user(new.user_id, 'used_status', 'Your listing is live ✓',
          'Your used bike listing has been approved and is now public' ||
          case when new.is_verified_listing then ' and marked Verified.' else '.' end,
          '/used-bikes/' || new.id::text);
      when 'rejected' then
        perform public.notify_user(new.user_id, 'used_status', 'Listing rejected',
          'Your listing was rejected. Reason: ' || coalesce(new.reject_reason, 'not specified'),
          '/account/used');
      when 'changes_required' then
        perform public.notify_user(new.user_id, 'used_status', 'Please update your listing',
          'We need changes before approving your listing: ' || coalesce(new.reject_reason, 'see listing'),
          '/account/used/' || new.id::text || '/edit');
      when 'submitted' then
        perform public.notify_user(new.user_id, 'used_status', 'Listing resubmitted',
          'Your updated listing is waiting for approval again.',
          '/account/used');
        for rec in select id from public.profiles where role = 'admin'
        loop
          insert into public.notifications (user_id, type, title, body, link)
          values (rec.id, 'used_pending', 'Used bike resubmitted',
                  new.model_name || ' was resubmitted for approval.',
                  '/admin/used');
        end loop;
    end case;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_used_status on public.used_bikes;
create trigger trg_used_status
  after insert or update on public.used_bikes
  for each row execute function public.on_used_status_change();

-- enquiries: notify the recipient
create or replace function public.on_enquiry_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare duuid uuid;
begin
  if new.to_user_id is not null then
    perform public.notify_user(new.to_user_id, 'enquiry', 'New enquiry',
      coalesce(new.message, 'A new enquiry was submitted.'),
      '/account/enquiries');
  end if;
  if new.to_dealer_id is not null then
    select user_id into duuid from public.dealer_profiles where id = new.to_dealer_id;
    if duuid is not null then
      perform public.notify_user(duuid, 'enquiry', 'New enquiry for your offer',
        coalesce(new.message, 'A buyer is interested in your offer.'),
        '/dealer/enquiries');
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_enquiry_created on public.enquiries;
create trigger trg_enquiry_created
  after insert on public.enquiries
  for each row execute function public.on_enquiry_created();

-- reports: notify admins
create or replace function public.on_report_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  for rec in select id from public.profiles where role = 'admin'
  loop
    insert into public.notifications (user_id, type, title, body, link)
    values (rec.id, 'report_new', 'New report: ' || new.item_type,
            new.reason || coalesce(' — ' || new.details, '') || ' (item ' || left(new.item_id, 8) || '…)',
            '/admin/reports');
  end loop;
  return new;
end;
$$;
drop trigger if exists trg_report_created on public.reports;
create trigger trg_report_created
  after insert on public.reports
  for each row execute function public.on_report_created();

-- ─── Realtime: let the bell update live ────────────────────────────────────
do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end;
$$;

-- ─── Image processing dispatch (called by the edge function wrapper) ──────
-- Mark a bike image as processing/completed and record the job.
create or replace function public.mark_image_processing(image_id uuid, p_status text, p_processed_path text default null, p_error text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status = 'processing' then
    insert into public.image_processing_jobs (table_name, image_id, status)
    values ('bike_images', image_id, 'processing');
    update public.bike_images set processing_status = 'processing' where id = image_id;
  elsif p_status in ('completed', 'failed', 'skipped') then
    update public.image_processing_jobs
       set status = p_status,
           error = p_error,
           completed_at = now()
     where id = (select id from public.image_processing_jobs
                  where table_name = 'bike_images' and image_id = image_id and status = 'processing'
                  order by created_at desc limit 1);
    update public.bike_images
       set processing_status = p_status,
           processed_path = coalesce(p_processed_path, processed_path)
     where id = image_id;
  end if;
end;
$$;
