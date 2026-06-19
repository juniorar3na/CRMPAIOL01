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
      base_conhecimento: {
        Row: {
          ativo: boolean
          categoria: string
          clinica_id: string
          conteudo: string
          created_at: string
          id: string
          titulo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          clinica_id: string
          conteudo: string
          created_at?: string
          id?: string
          titulo: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          clinica_id?: string
          conteudo?: string
          created_at?: string
          id?: string
          titulo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_conhecimento_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_conhecimento_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      clinicas: {
        Row: {
          cnpj: string | null
          created_at: string
          data_cadastro: string
          dia_vencimento: number | null
          email: string | null
          id: string
          nome: string
          plano: string | null
          proximo_vencimento: string | null
          rede: string | null
          responsavel: string | null
          status: string
          status_contrato: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          data_cadastro?: string
          dia_vencimento?: number | null
          email?: string | null
          id?: string
          nome: string
          plano?: string | null
          proximo_vencimento?: string | null
          rede?: string | null
          responsavel?: string | null
          status?: string
          status_contrato?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          data_cadastro?: string
          dia_vencimento?: number | null
          email?: string | null
          id?: string
          nome?: string
          plano?: string | null
          proximo_vencimento?: string | null
          rede?: string | null
          responsavel?: string | null
          status?: string
          status_contrato?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conversas: {
        Row: {
          clinica_id: string
          cpf: string | null
          created_at: string
          especie: string | null
          etiquetas: string[]
          id: string
          idade: string | null
          motivo: string | null
          origem: string
          pet: string | null
          prioridade: string
          proxima_acao: string | null
          raca: string | null
          resumo_ia: string | null
          servico_recomendado: string | null
          sintomas: string[]
          status: string
          telefone: string | null
          tutor: string
          unidade_id: string
          unread_by_human: boolean
          updated_at: string
        }
        Insert: {
          clinica_id: string
          cpf?: string | null
          created_at?: string
          especie?: string | null
          etiquetas?: string[] | null
          id?: string
          idade?: string | null
          motivo?: string | null
          origem?: string
          pet?: string | null
          prioridade?: string
          proxima_acao?: string | null
          raca?: string | null
          resumo_ia?: string | null
          servico_recomendado?: string | null
          sintomas?: string[]
          status?: string
          telefone?: string | null
          tutor: string
          unidade_id: string
          unread_by_human?: boolean
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          cpf?: string | null
          created_at?: string
          especie?: string | null
          etiquetas?: string[] | null
          id?: string
          idade?: string | null
          motivo?: string | null
          origem?: string
          pet?: string | null
          prioridade?: string
          proxima_acao?: string | null
          raca?: string | null
          resumo_ia?: string | null
          servico_recomendado?: string | null
          sintomas?: string[]
          status?: string
          telefone?: string | null
          tutor?: string
          unidade_id?: string
          unread_by_human?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      exames: {
        Row: {
          clinica_id: string
          cpf: string | null
          created_at: string
          id: string
          link_lab: string | null
          login_informado: boolean
          pet: string
          senha_informada: boolean
          status: string
          tipo: string | null
          tutor: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          clinica_id: string
          cpf?: string | null
          created_at?: string
          id?: string
          link_lab?: string | null
          login_informado?: boolean
          pet: string
          senha_informada?: boolean
          status?: string
          tipo?: string | null
          tutor: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          cpf?: string | null
          created_at?: string
          id?: string
          link_lab?: string | null
          login_informado?: boolean
          pet?: string
          senha_informada?: boolean
          status?: string
          tipo?: string | null
          tutor?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      internacoes: {
        Row: {
          clinica_id: string
          cpf: string | null
          created_at: string
          data: string
          id: string
          mensagem_autorizada: string | null
          observacoes: string | null
          pet: string
          status: string
          tutor: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          clinica_id: string
          cpf?: string | null
          created_at?: string
          data?: string
          id?: string
          mensagem_autorizada?: string | null
          observacoes?: string | null
          pet: string
          status?: string
          tutor: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          cpf?: string | null
          created_at?: string
          data?: string
          id?: string
          mensagem_autorizada?: string | null
          observacoes?: string | null
          pet?: string
          status?: string
          tutor?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          conteudo: string
          conversa_id: string
          created_at: string
          id: string
          remetente: string
          status: string
        }
        Insert: {
          conteudo: string
          conversa_id: string
          created_at?: string
          id?: string
          remetente: string
          status?: string
        }
        Update: {
          conteudo?: string
          conversa_id?: string
          created_at?: string
          id?: string
          remetente?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      regras_ia: {
        Row: {
          ativo: boolean
          clinica_id: string
          created_at: string
          id: string
          informacoes_proibidas: string | null
          mensagem_boas_vindas: string | null
          mensagem_casos_sensiveis: string | null
          palavras_urgencia: string[]
          quando_chamar_humano: string | null
          quando_responder_sozinha: string | null
          servicos_precisam_humano: string[]
          tom_de_voz: string | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          created_at?: string
          id?: string
          informacoes_proibidas?: string | null
          mensagem_boas_vindas?: string | null
          mensagem_casos_sensiveis?: string | null
          palavras_urgencia?: string[]
          quando_chamar_humano?: string | null
          quando_responder_sozinha?: string | null
          servicos_precisam_humano?: string[]
          tom_de_voz?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          id?: string
          informacoes_proibidas?: string | null
          mensagem_boas_vindas?: string | null
          mensagem_casos_sensiveis?: string | null
          palavras_urgencia?: string[]
          quando_chamar_humano?: string | null
          quando_responder_sozinha?: string | null
          servicos_precisam_humano?: string[]
          tom_de_voz?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regras_ia_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_ia_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          atende_24h: boolean
          bairro: string | null
          cidade: string | null
          clinica_id: string
          created_at: string
          endereco: string | null
          google_maps_url: string | null
          horario_funcionamento: string | null
          id: string
          laboratorio_url: string | null
          nome: string
          servicos: string[]
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          atende_24h?: boolean
          bairro?: string | null
          cidade?: string | null
          clinica_id: string
          created_at?: string
          endereco?: string | null
          google_maps_url?: string | null
          horario_funcionamento?: string | null
          id?: string
          laboratorio_url?: string | null
          nome: string
          servicos?: string[]
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          atende_24h?: boolean
          bairro?: string | null
          cidade?: string | null
          clinica_id?: string
          created_at?: string
          endereco?: string | null
          google_maps_url?: string | null
          horario_funcionamento?: string | null
          id?: string
          laboratorio_url?: string | null
          nome?: string
          servicos?: string[]
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unidades_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          clinica_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          unidade_id: string | null
          user_id: string
        }
        Insert: {
          clinica_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          unidade_id?: string | null
          user_id: string
        }
        Update: {
          clinica_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          unidade_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_sessoes: {
        Row: {
          api_token: string | null
          clinica_id: string
          connected_at: string | null
          created_at: string
          id: string
          instance_name: string
          last_seen_at: string | null
          numero_conectado: string | null
          qr_code: string | null
          status: string
          unidade_id: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          api_token?: string | null
          clinica_id: string
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_name: string
          last_seen_at?: string | null
          numero_conectado?: string | null
          qr_code?: string | null
          status?: string
          unidade_id: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          api_token?: string | null
          clinica_id?: string
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_name?: string
          last_seen_at?: string | null
          numero_conectado?: string | null
          qr_code?: string | null
          status?: string
          unidade_id?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_agencia: { Args: { _uid: string }; Returns: boolean }
      user_clinica_id: { Args: { _uid: string }; Returns: string }
      user_unidade_id: { Args: { _uid: string }; Returns: string }
    }
    Enums: {
      app_role: "agencia" | "gestor" | "recepcao"
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
    Enums: {
      app_role: ["agencia", "gestor", "recepcao"],
    },
  },
} as const
