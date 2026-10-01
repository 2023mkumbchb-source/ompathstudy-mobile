// Every articles column except `content_fts`. content_fts is a ~16 MB search
// index (tsvector) that the client never reads, and `select("*")` was shipping
// it with every article download, roughly doubling egress. Filter on it
// server-side if needed; never select it.
export const ARTICLE_COLUMNS =
  "id,title,content,created_at,published,original_notes,category,deleted_at,meta_title,meta_description,og_image_url,slug,updated_at,countdown,html_embed,password_protected,access_password,scheduled_at,tags,featured_image,reading_time_minutes,toc_enabled,comments_enabled,university,school,lecturer,exam_type,exam_year,unit,content_kind,is_raw,unit_id,semester_number,verification_status,completeness_status,reviewed_by,reviewed_at,source_type,source_reference,confidence_score,contains_answer_key,answer_key_verified,requires_review,content_type";
