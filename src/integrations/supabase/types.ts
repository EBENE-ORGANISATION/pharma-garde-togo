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
      admin_users: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: []
      }
      jours_feries: {
        Row: {
          a_confirmer: boolean | null
          created_at: string | null
          date: string
          id: string
          nom: string
        }
        Insert: {
          a_confirmer?: boolean | null
          created_at?: string | null
          date: string
          id?: string
          nom: string
        }
        Update: {
          a_confirmer?: boolean | null
          created_at?: string | null
          date?: string
          id?: string
          nom?: string
        }
        Relationships: []
      }
      medicaments: {
        Row: {
          created_at: string
          dci: string
          dosage: string | null
          forme: string | null
          id: string
          nom_commercial: string | null
        }
        Insert: {
          created_at?: string
          dci: string
          dosage?: string | null
          forme?: string | null
          id?: string
          nom_commercial?: string | null
        }
        Update: {
          created_at?: string
          dci?: string
          dosage?: string | null
          forme?: string | null
          id?: string
          nom_commercial?: string | null
        }
        Relationships: []
      }
      numeros_urgence: {
        Row: {
          actif: boolean
          created_at: string
          id: string
          libelle: string
          numero: string
          ordre: number
          zone_id: string | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          id?: string
          libelle: string
          numero: string
          ordre?: number
          zone_id?: string | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          id?: string
          libelle?: string
          numero?: string
          ordre?: number
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "numeros_urgence_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacies: {
        Row: {
          actif: boolean
          adresse: string | null
          created_at: string
          geo_source: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nom: string
          slug: string | null
          telephone: string | null
          zone_id: string | null
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          created_at?: string
          geo_source?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom: string
          slug?: string | null
          telephone?: string | null
          zone_id?: string | null
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          created_at?: string
          geo_source?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom?: string
          slug?: string | null
          telephone?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacies_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_garde: {
        Row: {
          created_at: string
          date_debut: string
          date_fin: string
          id: string
          pharmacie_id: string
          source: string | null
          statut: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          date_debut: string
          date_fin: string
          id?: string
          pharmacie_id: string
          source?: string | null
          statut?: string
          zone_id: string
        }
        Update: {
          created_at?: string
          date_debut?: string
          date_fin?: string
          id?: string
          pharmacie_id?: string
          source?: string | null
          statut?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_garde_pharmacie_id_fkey"
            columns: ["pharmacie_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_garde_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshots: {
        Row: {
          data: Json
          id: string
          published_at: string
          semaine: string | null
          version: number
          zone_id: string
        }
        Insert: {
          data: Json
          id?: string
          published_at?: string
          semaine?: string | null
          version?: number
          zone_id: string
        }
        Update: {
          data?: Json
          id?: string
          published_at?: string
          semaine?: string | null
          version?: number
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "snapshots_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          actif: boolean
          created_at: string
          id: string
          nom: string
          region: string | null
          slug: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          id?: string
          nom: string
          region?: string | null
          slug: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          id?: string
          nom?: string
          region?: string | null
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      importer_garde: {
        Args: { p_a: string; p_de: string; p_slugs: string[] }
        Returns: {
          deja_publiees: number
          inserees: number
          slugs_inconnus: string[]
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      publier_garde_auto: {
        Args: { p_a: string; p_de: string }
        Returns: {
          pharmacies_publiees: number
          zone: string
        }[]
      }
      publier_zone: {
        Args: { p_zone_id: string }
        Returns: {
          data: Json
          id: string
          published_at: string
          semaine: string | null
          version: number
          zone_id: string
        }
        SetofOptions: {
          from: "*"
          to: "snapshots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
