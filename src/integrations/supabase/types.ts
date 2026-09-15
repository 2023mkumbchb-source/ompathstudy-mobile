export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academic_years: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          published: boolean
          title: string
          updated_at: string
          year_number: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          published?: boolean
          title: string
          updated_at?: string
          year_number: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          published?: boolean
          title?: string
          updated_at?: string
          year_number?: number
        }
        Relationships: []
      }
      access_grants: {
        Row: {
          allow_download: boolean
          amount: number | null
          code: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          last_redeemed_at: string | null
          payment_id: string | null
          phone_number: string | null
          plan: string
          redeem_count: number
          scope: string
          user_id: string | null
        }
        Insert: {
          allow_download?: boolean
          amount?: number | null
          code: string
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          last_redeemed_at?: string | null
          payment_id?: string | null
          phone_number?: string | null
          plan?: string
          redeem_count?: number
          scope?: string
          user_id?: string | null
        }
        Update: {
          allow_download?: boolean
          amount?: number | null
          code?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          last_redeemed_at?: string | null
          payment_id?: string | null
          phone_number?: string | null
          plan?: string
          redeem_count?: number
          scope?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_grants_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      article_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      article_comments: {
        Row: {
          article_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
        }
        Insert: {
          article_id: string
          author_name?: string
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
        }
        Update: {
          article_id?: string
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "article_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          access_password: string | null
          answer_key_verified: boolean
          category: string
          comments_enabled: boolean
          completeness_status: string
          confidence_score: number | null
          contains_answer_key: boolean
          content: string
          content_fts: unknown
          content_kind: string | null
          content_type: string | null
          countdown: Json | null
          created_at: string
          deleted_at: string | null
          exam_type: string | null
          exam_year: string | null
          featured_image: string | null
          html_embed: Json | null
          id: string
          is_raw: boolean | null
          lecturer: string | null
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          original_notes: string
          password_protected: boolean
          published: boolean
          reading_time_minutes: number | null
          requires_review: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_at: string | null
          school: string | null
          semester_number: number | null
          slug: string | null
          source_reference: string | null
          source_type: string | null
          tags: string[]
          title: string
          toc_enabled: boolean
          unit: string | null
          unit_id: string | null
          university: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          access_password?: string | null
          answer_key_verified?: boolean
          category?: string
          comments_enabled?: boolean
          completeness_status?: string
          confidence_score?: number | null
          contains_answer_key?: boolean
          content?: string
          content_fts?: unknown
          content_kind?: string | null
          content_type?: string | null
          countdown?: Json | null
          created_at?: string
          deleted_at?: string | null
          exam_type?: string | null
          exam_year?: string | null
          featured_image?: string | null
          html_embed?: Json | null
          id?: string
          is_raw?: boolean | null
          lecturer?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          original_notes?: string
          password_protected?: boolean
          published?: boolean
          reading_time_minutes?: number | null
          requires_review?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_at?: string | null
          school?: string | null
          semester_number?: number | null
          slug?: string | null
          source_reference?: string | null
          source_type?: string | null
          tags?: string[]
          title: string
          toc_enabled?: boolean
          unit?: string | null
          unit_id?: string | null
          university?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          access_password?: string | null
          answer_key_verified?: boolean
          category?: string
          comments_enabled?: boolean
          completeness_status?: string
          confidence_score?: number | null
          contains_answer_key?: boolean
          content?: string
          content_fts?: unknown
          content_kind?: string | null
          content_type?: string | null
          countdown?: Json | null
          created_at?: string
          deleted_at?: string | null
          exam_type?: string | null
          exam_year?: string | null
          featured_image?: string | null
          html_embed?: Json | null
          id?: string
          is_raw?: boolean | null
          lecturer?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          original_notes?: string
          password_protected?: boolean
          published?: boolean
          reading_time_minutes?: number | null
          requires_review?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_at?: string | null
          school?: string | null
          semester_number?: number | null
          slug?: string | null
          source_reference?: string | null
          source_type?: string | null
          tags?: string[]
          title?: string
          toc_enabled?: boolean
          unit?: string | null
          unit_id?: string | null
          university?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_link_clicks: {
        Row: {
          concept_id: string | null
          created_at: string
          from_resource_id: string | null
          from_resource_type: string | null
          id: string
          to_article_id: string | null
        }
        Insert: {
          concept_id?: string | null
          created_at?: string
          from_resource_id?: string | null
          from_resource_type?: string | null
          id?: string
          to_article_id?: string | null
        }
        Update: {
          concept_id?: string | null
          created_at?: string
          from_resource_id?: string | null
          from_resource_type?: string | null
          id?: string
          to_article_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concept_link_clicks_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "medical_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_relationships: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          relationship_type: string
          relevance_score: number
          source_concept_id: string
          target_concept_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          relationship_type?: string
          relevance_score?: number
          source_concept_id: string
          target_concept_id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          relationship_type?: string
          relevance_score?: number
          source_concept_id?: string
          target_concept_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_relationships_source_concept_id_fkey"
            columns: ["source_concept_id"]
            isOneToOne: false
            referencedRelation: "medical_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_relationships_target_concept_id_fkey"
            columns: ["target_concept_id"]
            isOneToOne: false
            referencedRelation: "medical_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          assigned_admin_id: string | null
          created_at: string
          device_info: string | null
          id: string
          message: string | null
          report_type: string
          resolution_notes: string | null
          resolved_at: string | null
          resource_id: string
          resource_type: string
          resource_url: string | null
          section_anchor: string | null
          selected_text: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          assigned_admin_id?: string | null
          created_at?: string
          device_info?: string | null
          id?: string
          message?: string | null
          report_type: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resource_id: string
          resource_type: string
          resource_url?: string | null
          section_anchor?: string | null
          selected_text?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          assigned_admin_id?: string | null
          created_at?: string
          device_info?: string | null
          id?: string
          message?: string | null
          report_type?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resource_id?: string
          resource_type?: string
          resource_url?: string | null
          section_anchor?: string | null
          selected_text?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      essays: {
        Row: {
          article_id: string | null
          category: string
          created_at: string
          deleted_at: string | null
          id: string
          long_answer_questions: Json
          published: boolean
          short_answer_questions: Json
          slug: string | null
          title: string
          updated_at: string
        }
        Insert: {
          article_id?: string | null
          category?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          long_answer_questions?: Json
          published?: boolean
          short_answer_questions?: Json
          slug?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          article_id?: string | null
          category?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          long_answer_questions?: Json
          published?: boolean
          short_answer_questions?: Json
          slug?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "essays_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          answers: Json
          completed: boolean
          created_at: string
          duration_seconds: number | null
          exam_id: string
          id: string
          maximum_score: number | null
          percentage: number | null
          score: number | null
          started_at: string
          submitted_at: string | null
          topic_breakdown: Json
          user_id: string
        }
        Insert: {
          answers?: Json
          completed?: boolean
          created_at?: string
          duration_seconds?: number | null
          exam_id: string
          id?: string
          maximum_score?: number | null
          percentage?: number | null
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          topic_breakdown?: Json
          user_id: string
        }
        Update: {
          answers?: Json
          completed?: boolean
          created_at?: string
          duration_seconds?: number | null
          exam_id?: string
          id?: string
          maximum_score?: number | null
          percentage?: number | null
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          topic_breakdown?: Json
          user_id?: string
        }
        Relationships: []
      }
      exam_results: {
        Row: {
          course: string
          created_at: string
          exam_id: string
          exam_title: string
          id: string
          laq_answers: Json
          mcq_score: number
          mcq_total: number
          saq_answers: Json
          student_name: string
          submit_reason: string | null
          submitted_at: string
          time_taken_seconds: number
          unit: string
          university: string
        }
        Insert: {
          course?: string
          created_at?: string
          exam_id: string
          exam_title?: string
          id?: string
          laq_answers?: Json
          mcq_score?: number
          mcq_total?: number
          saq_answers?: Json
          student_name?: string
          submit_reason?: string | null
          submitted_at?: string
          time_taken_seconds?: number
          unit?: string
          university?: string
        }
        Update: {
          course?: string
          created_at?: string
          exam_id?: string
          exam_title?: string
          id?: string
          laq_answers?: Json
          mcq_score?: number
          mcq_total?: number
          saq_answers?: Json
          student_name?: string
          submit_reason?: string | null
          submitted_at?: string
          time_taken_seconds?: number
          unit?: string
          university?: string
        }
        Relationships: []
      }
      flashcard_sets: {
        Row: {
          access_password: string | null
          answer_key_verified: boolean
          cards: Json
          category: string
          comments_enabled: boolean
          completeness_status: string
          confidence_score: number | null
          contains_answer_key: boolean
          content_type: string | null
          countdown: Json | null
          created_at: string
          deleted_at: string | null
          featured_image: string | null
          html_embed: Json | null
          id: string
          is_raw: boolean | null
          original_notes: string
          password_protected: boolean
          published: boolean
          reading_time_minutes: number | null
          requires_review: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_at: string | null
          slug: string | null
          source_reference: string | null
          source_type: string | null
          tags: string[]
          title: string
          toc_enabled: boolean
          unit_id: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          access_password?: string | null
          answer_key_verified?: boolean
          cards?: Json
          category?: string
          comments_enabled?: boolean
          completeness_status?: string
          confidence_score?: number | null
          contains_answer_key?: boolean
          content_type?: string | null
          countdown?: Json | null
          created_at?: string
          deleted_at?: string | null
          featured_image?: string | null
          html_embed?: Json | null
          id?: string
          is_raw?: boolean | null
          original_notes?: string
          password_protected?: boolean
          published?: boolean
          reading_time_minutes?: number | null
          requires_review?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_at?: string | null
          slug?: string | null
          source_reference?: string | null
          source_type?: string | null
          tags?: string[]
          title: string
          toc_enabled?: boolean
          unit_id?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          access_password?: string | null
          answer_key_verified?: boolean
          cards?: Json
          category?: string
          comments_enabled?: boolean
          completeness_status?: string
          confidence_score?: number | null
          contains_answer_key?: boolean
          content_type?: string | null
          countdown?: Json | null
          created_at?: string
          deleted_at?: string | null
          featured_image?: string | null
          html_embed?: Json | null
          id?: string
          is_raw?: boolean | null
          original_notes?: string
          password_protected?: boolean
          published?: boolean
          reading_time_minutes?: number | null
          requires_review?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_at?: string | null
          slug?: string | null
          source_reference?: string | null
          source_type?: string | null
          tags?: string[]
          title?: string
          toc_enabled?: boolean
          unit_id?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_sets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      mcq_sets: {
        Row: {
          access_password: string
          answer_key_verified: boolean
          category: string
          comments_enabled: boolean
          completeness_status: string
          confidence_score: number | null
          contains_answer_key: boolean
          content_type: string | null
          countdown: Json | null
          created_at: string
          deleted_at: string | null
          exam_type: string | null
          exam_year: string | null
          featured_image: string | null
          html_embed: Json | null
          id: string
          is_raw: boolean | null
          lecturer: string | null
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          original_notes: string
          password_protected: boolean
          published: boolean
          questions: Json
          reading_time_minutes: number | null
          requires_review: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_at: string | null
          school: string | null
          semester_number: number | null
          slug: string | null
          source_reference: string | null
          source_type: string | null
          tags: string[]
          title: string
          toc_enabled: boolean
          unit: string | null
          unit_id: string | null
          university: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          access_password?: string
          answer_key_verified?: boolean
          category?: string
          comments_enabled?: boolean
          completeness_status?: string
          confidence_score?: number | null
          contains_answer_key?: boolean
          content_type?: string | null
          countdown?: Json | null
          created_at?: string
          deleted_at?: string | null
          exam_type?: string | null
          exam_year?: string | null
          featured_image?: string | null
          html_embed?: Json | null
          id?: string
          is_raw?: boolean | null
          lecturer?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          original_notes?: string
          password_protected?: boolean
          published?: boolean
          questions?: Json
          reading_time_minutes?: number | null
          requires_review?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_at?: string | null
          school?: string | null
          semester_number?: number | null
          slug?: string | null
          source_reference?: string | null
          source_type?: string | null
          tags?: string[]
          title: string
          toc_enabled?: boolean
          unit?: string | null
          unit_id?: string | null
          university?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          access_password?: string
          answer_key_verified?: boolean
          category?: string
          comments_enabled?: boolean
          completeness_status?: string
          confidence_score?: number | null
          contains_answer_key?: boolean
          content_type?: string | null
          countdown?: Json | null
          created_at?: string
          deleted_at?: string | null
          exam_type?: string | null
          exam_year?: string | null
          featured_image?: string | null
          html_embed?: Json | null
          id?: string
          is_raw?: boolean | null
          lecturer?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          original_notes?: string
          password_protected?: boolean
          published?: boolean
          questions?: Json
          reading_time_minutes?: number | null
          requires_review?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_at?: string | null
          school?: string | null
          semester_number?: number | null
          slug?: string | null
          source_reference?: string | null
          source_type?: string | null
          tags?: string[]
          title?: string
          toc_enabled?: boolean
          unit?: string | null
          unit_id?: string | null
          university?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcq_sets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_concept_aliases: {
        Row: {
          abbreviation: boolean
          alias: string
          approved: boolean
          concept_id: string
          created_at: string
          id: string
          spelling_variant: boolean
        }
        Insert: {
          abbreviation?: boolean
          alias: string
          approved?: boolean
          concept_id: string
          created_at?: string
          id?: string
          spelling_variant?: boolean
        }
        Update: {
          abbreviation?: boolean
          alias?: string
          approved?: boolean
          concept_id?: string
          created_at?: string
          id?: string
          spelling_variant?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "medical_concept_aliases_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "medical_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_concepts: {
        Row: {
          approved: boolean
          canonical_term: string
          click_count: number
          created_at: string
          definition: string | null
          enabled: boolean
          id: string
          importance: number
          preferred_article_id: string | null
          preferred_topic_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          approved?: boolean
          canonical_term: string
          click_count?: number
          created_at?: string
          definition?: string | null
          enabled?: boolean
          id?: string
          importance?: number
          preferred_article_id?: string | null
          preferred_topic_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          approved?: boolean
          canonical_term?: string
          click_count?: number
          created_at?: string
          definition?: string | null
          enabled?: boolean
          id?: string
          importance?: number
          preferred_article_id?: string | null
          preferred_topic_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_concepts_preferred_article_id_fkey"
            columns: ["preferred_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_concepts_preferred_topic_id_fkey"
            columns: ["preferred_topic_id"]
            isOneToOne: false
            referencedRelation: "syllabus_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_concepts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          buyer_email: string | null
          buyer_name: string | null
          created_at: string
          id: string
          mpesa_code: string | null
          package_type: string | null
          payment_status: string
          phone_number: string
          project_id: string | null
          provider_txn_id: string | null
          transaction_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          id?: string
          mpesa_code?: string | null
          package_type?: string | null
          payment_status?: string
          phone_number: string
          project_id?: string | null
          provider_txn_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          id?: string
          mpesa_code?: string | null
          package_type?: string | null
          payment_status?: string
          phone_number?: string
          project_id?: string | null
          provider_txn_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pending_institutions: {
        Row: {
          id: string
          reviewed_at: string | null
          status: string
          submitted_at: string
          submitted_by: string | null
          type: string
          value: string
        }
        Insert: {
          id?: string
          reviewed_at?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          type: string
          value: string
        }
        Update: {
          id?: string
          reviewed_at?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          type?: string
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      resource_feedback: {
        Row: {
          created_at: string
          id: string
          resource_id: string
          resource_type: string
          user_id: string | null
          vote: string
        }
        Insert: {
          created_at?: string
          id?: string
          resource_id: string
          resource_type: string
          user_id?: string | null
          vote: string
        }
        Update: {
          created_at?: string
          id?: string
          resource_id?: string
          resource_type?: string
          user_id?: string | null
          vote?: string
        }
        Relationships: []
      }
      resource_topics: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          relationship_type: string
          relevance_score: number
          resource_id: string
          resource_type: string
          topic_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          relationship_type?: string
          relevance_score?: number
          resource_id: string
          resource_type: string
          topic_id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          relationship_type?: string
          relevance_score?: number
          resource_id?: string
          resource_type?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "syllabus_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      revision_plan_items: {
        Row: {
          activity: string
          created_at: string
          display_order: number
          estimated_minutes: number
          id: string
          plan_id: string
          resource_id: string | null
          resource_title: string | null
          resource_type: string | null
          scheduled_date: string
          status: string
          topic_id: string | null
          unit_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity?: string
          created_at?: string
          display_order?: number
          estimated_minutes?: number
          id?: string
          plan_id: string
          resource_id?: string | null
          resource_title?: string | null
          resource_type?: string | null
          scheduled_date: string
          status?: string
          topic_id?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity?: string
          created_at?: string
          display_order?: number
          estimated_minutes?: number
          id?: string
          plan_id?: string
          resource_id?: string | null
          resource_title?: string | null
          resource_type?: string | null
          scheduled_date?: string
          status?: string
          topic_id?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "revision_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_plan_items_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "syllabus_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_plan_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      revision_plans: {
        Row: {
          academic_year_id: string | null
          active: boolean
          activity_types: string[]
          confidence_level: number | null
          created_at: string
          daily_minutes: number | null
          exam_date: string | null
          id: string
          rest_days: number[]
          study_days: number | null
          title: string
          unit_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year_id?: string | null
          active?: boolean
          activity_types?: string[]
          confidence_level?: number | null
          created_at?: string
          daily_minutes?: number | null
          exam_date?: string | null
          id?: string
          rest_days?: number[]
          study_days?: number | null
          title: string
          unit_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year_id?: string | null
          active?: boolean
          activity_types?: string[]
          confidence_level?: number | null
          created_at?: string
          daily_minutes?: number | null
          exam_date?: string | null
          id?: string
          rest_days?: number[]
          study_days?: number | null
          title?: string
          unit_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_plans_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      search_aliases: {
        Row: {
          alias: string
          approved: boolean
          canonical_term: string
          created_at: string
          id: string
          priority: number
          topic_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          alias: string
          approved?: boolean
          canonical_term: string
          created_at?: string
          id?: string
          priority?: number
          topic_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          alias?: string
          approved?: boolean
          canonical_term?: string
          created_at?: string
          id?: string
          priority?: number
          topic_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_aliases_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "syllabus_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_aliases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      search_queries: {
        Row: {
          clicked_resource_id: string | null
          clicked_resource_type: string | null
          created_at: string
          id: string
          normalized_query: string | null
          query: string
          results_count: number
          user_id: string | null
        }
        Insert: {
          clicked_resource_id?: string | null
          clicked_resource_type?: string | null
          created_at?: string
          id?: string
          normalized_query?: string | null
          query: string
          results_count?: number
          user_id?: string | null
        }
        Update: {
          clicked_resource_id?: string | null
          clicked_resource_type?: string | null
          created_at?: string
          id?: string
          normalized_query?: string | null
          query?: string
          results_count?: number
          user_id?: string | null
        }
        Relationships: []
      }
      semesters: {
        Row: {
          academic_year_id: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          semester_number: number
          title: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          semester_number: number
          title: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          semester_number?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "semesters_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      slide_corrections: {
        Row: {
          admin_note: string | null
          article_id: string
          created_at: string
          id: string
          slide_number: string
          slide_prompt: string | null
          status: string
          submitter_name: string | null
          suggestion: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          article_id: string
          created_at?: string
          id?: string
          slide_number: string
          slide_prompt?: string | null
          status?: string
          submitter_name?: string | null
          suggestion: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          article_id?: string
          created_at?: string
          id?: string
          slide_number?: string
          slide_prompt?: string | null
          status?: string
          submitter_name?: string | null
          suggestion?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slide_corrections_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          access_password: string | null
          category: string
          comments_enabled: boolean
          content: string
          countdown: Json | null
          cover_image_url: string | null
          created_at: string
          deleted_at: string | null
          featured_image: string | null
          html_embed: Json | null
          id: string
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          password_protected: boolean
          published: boolean
          reading_time_minutes: number | null
          scheduled_at: string | null
          slug: string | null
          submitted_by: string | null
          tags: string[]
          title: string
          toc_enabled: boolean
        }
        Insert: {
          access_password?: string | null
          category?: string
          comments_enabled?: boolean
          content?: string
          countdown?: Json | null
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          featured_image?: string | null
          html_embed?: Json | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          password_protected?: boolean
          published?: boolean
          reading_time_minutes?: number | null
          scheduled_at?: string | null
          slug?: string | null
          submitted_by?: string | null
          tags?: string[]
          title: string
          toc_enabled?: boolean
        }
        Update: {
          access_password?: string | null
          category?: string
          comments_enabled?: boolean
          content?: string
          countdown?: Json | null
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          featured_image?: string | null
          html_embed?: Json | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          password_protected?: boolean
          published?: boolean
          reading_time_minutes?: number | null
          scheduled_at?: string | null
          slug?: string | null
          submitted_by?: string | null
          tags?: string[]
          title?: string
          toc_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "stories_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabus_topics: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          importance: string
          learning_objectives: string | null
          parent_topic_id: string | null
          published: boolean
          slug: string | null
          title: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          importance?: string
          learning_objectives?: string | null
          parent_topic_id?: string | null
          published?: boolean
          slug?: string | null
          title: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          importance?: string
          learning_objectives?: string | null
          parent_topic_id?: string | null
          published?: boolean
          slug?: string | null
          title?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "syllabus_topics_parent_topic_id_fkey"
            columns: ["parent_topic_id"]
            isOneToOne: false
            referencedRelation: "syllabus_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syllabus_topics_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          academic_year_id: string
          color: string | null
          course_code: string | null
          created_at: string
          description: string | null
          display_order: number
          exam_information: string | null
          icon: string | null
          id: string
          learning_objectives: string | null
          legacy_category: string | null
          name: string
          published: boolean
          semester_id: string | null
          short_name: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          color?: string | null
          course_code?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          exam_information?: string | null
          icon?: string | null
          id?: string
          learning_objectives?: string | null
          legacy_category?: string | null
          name: string
          published?: boolean
          semester_id?: string | null
          short_name?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          color?: string | null
          course_code?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          exam_information?: string | null
          icon?: string | null
          id?: string
          learning_objectives?: string | null
          legacy_category?: string | null
          name?: string
          published?: boolean
          semester_id?: string | null
          short_name?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_answers: {
        Row: {
          correct_answer: number
          created_at: string
          id: string
          is_correct: boolean
          mcq_set_id: string
          question_index: number
          question_text: string
          selected_answer: number
          user_id: string
        }
        Insert: {
          correct_answer: number
          created_at?: string
          id?: string
          is_correct: boolean
          mcq_set_id: string
          question_index: number
          question_text?: string
          selected_answer: number
          user_id: string
        }
        Update: {
          correct_answer?: number
          created_at?: string
          id?: string
          is_correct?: boolean
          mcq_set_id?: string
          question_index?: number
          question_text?: string
          selected_answer?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_answers_mcq_set_id_fkey"
            columns: ["mcq_set_id"]
            isOneToOne: false
            referencedRelation: "mcq_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bookmarks: {
        Row: {
          collection_name: string | null
          created_at: string
          id: string
          resource_id: string
          resource_type: string
          user_id: string
        }
        Insert: {
          collection_name?: string | null
          created_at?: string
          id?: string
          resource_id: string
          resource_type: string
          user_id: string
        }
        Update: {
          collection_name?: string | null
          created_at?: string
          id?: string
          resource_id?: string
          resource_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_resource_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          first_opened_at: string
          id: string
          last_opened_at: string
          last_position: string | null
          progress_percent: number
          resource_id: string
          resource_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          first_opened_at?: string
          id?: string
          last_opened_at?: string
          last_position?: string | null
          progress_percent?: number
          resource_id: string
          resource_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          first_opened_at?: string
          id?: string
          last_opened_at?: string
          last_position?: string | null
          progress_percent?: number
          resource_id?: string
          resource_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_study_activity: {
        Row: {
          activity_type: string
          created_at: string
          duration_seconds: number
          id: string
          resource_id: string | null
          resource_type: string | null
          score: number | null
          topic_id: string | null
          unit_id: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          duration_seconds?: number
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          score?: number | null
          topic_id?: string | null
          unit_id?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          score?: number | null
          topic_id?: string | null
          unit_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_study_activity_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "syllabus_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_study_activity_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      user_topic_progress: {
        Row: {
          attempted_questions: number
          completed_at: string | null
          confidence_level: number
          correct_answers: number
          created_at: string
          id: string
          last_studied_at: string | null
          status: string
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempted_questions?: number
          completed_at?: string | null
          confidence_level?: number
          correct_answers?: number
          created_at?: string
          id?: string
          last_studied_at?: string | null
          status?: string
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempted_questions?: number
          completed_at?: string | null
          confidence_level?: number
          correct_answers?: number
          created_at?: string
          id?: string
          last_studied_at?: string | null
          status?: string
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_topic_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "syllabus_topics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _slugify: { Args: { input: string }; Returns: string }
      category_counts: {
        Args: never
        Returns: {
          articles: number
          flashcards: number
          latest: string
          mcqs: number
          name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      home_recent: {
        Args: { limit_n?: number }
        Returns: {
          category: string
          created_at: string
          id: string
          kind: string
          slug: string
          title: string
        }[]
      }
      slugify_title: { Args: { t: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
