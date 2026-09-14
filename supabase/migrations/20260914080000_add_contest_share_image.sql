alter table public.contests add column if not exists share_image_url text;
comment on column public.contests.share_image_url is 'Public HTTPS image used for contest cards and social sharing previews.';
update public.contests set share_image_url = 'https://www.ompathstudy.com/assets/ompath-logo-DD7-AL6w.png' where slug = 'hematology-live-contest-demo' and share_image_url is null;
