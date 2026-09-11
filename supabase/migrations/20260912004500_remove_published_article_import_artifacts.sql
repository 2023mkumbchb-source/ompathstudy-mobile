-- Remove deterministic publishing/import boilerplate from every published
-- article. These patterns are editorial artefacts rather than medical content.
-- Clinical prose, questions, answers, figures and article URLs are untouched.
with cleaned as (
  select id,
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            content,
            E'(?im)^[\\t ]*\\*?This complete [^\\n]+ is split into [0-9]+ parts? for easier reading\\.?\\*?[\\t ]*\\n*',
            '',
            'g'
          ),
          E'(?im)^[\\t ]*All [0-9]+ source pages were processed\\.[^\\n]*\\n*',
          '',
          'g'
        ),
        E'(?m)^[\\t ]*[0-9]+\\.[0-9]+[\\t ]*\\n+',
        '',
        'g'
      )
    ) as next_content
  from public.articles
  where published = true
    and deleted_at is null
    and (
      content ~* 'is split into [0-9]+ parts? for easier reading'
      or content ~* 'All [0-9]+ source pages were processed'
      or content ~ E'(?m)^[[:space:]]*[0-9]+\\.[0-9]+[[:space:]]*$'
    )
)
update public.articles a
set content = c.next_content,
    updated_at = now()
from cleaned c
where a.id = c.id
  and c.next_content <> a.content;
