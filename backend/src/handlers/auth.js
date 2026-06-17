import { supabase } from '../lib/supabase.js';

/**
 * POST /auth/create-recepcao
 * Cria um usuário de recepção usando o Service Role Key, inserindo a unidade e a role.
 */
export async function handleCreateRecepcao(req, res) {
  const { 
    email, 
    senha, 
    clinica_id, 
    nome, 
    endereco, 
    bairro, 
    cidade, 
    horario_funcionamento, 
    atende_24h, 
    whatsapp, 
    google_maps_url, 
    laboratorio_url, 
    servicos 
  } = req.body;

  if (!email || !senha || !clinica_id || !nome) {
    return res.status(400).json({ success: false, error: 'Campos obrigatórios faltando.' });
  }

  try {
    // 1. Criar usuário no Supabase Auth com Service Role
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { role: 'recepcao', clinica_id }
    });

    if (authError) {
      throw new Error(`Erro ao criar usuário: ${authError.message}`);
    }

    const userId = authData.user.id;

    // 2. Inserir a nova unidade na tabela unidades
    const { data: unidadeData, error: unidadeError } = await supabase.from('unidades').insert({
      clinica_id,
      nome,
      endereco: endereco || null,
      bairro: bairro || null,
      cidade: cidade || null,
      horario_funcionamento: horario_funcionamento || null,
      atende_24h,
      whatsapp: whatsapp || null,
      google_maps_url: google_maps_url || null,
      laboratorio_url: laboratorio_url || null,
      servicos
    }).select().single();

    if (unidadeError) {
      // Se falhar, tentamos deletar o usuário para não deixar lixo
      await supabase.auth.admin.deleteUser(userId);
      throw new Error(`Erro ao criar unidade: ${unidadeError.message}`);
    }

    const unidadeId = unidadeData.id;

    // 3. Inserir o cargo na tabela user_roles
    const { error: roleError } = await supabase.from('user_roles').insert({
      user_id: userId,
      role: 'recepcao',
      clinica_id,
      unidade_id: unidadeId
    });

    if (roleError) {
      console.error('[Auth] Aviso: Falha ao inserir user_roles', roleError.message);
      // Aqui poderíamos fazer rollback completo também
    }

    console.log(`[Auth] Usuário de recepção criado: ${email} para a unidade ${nome}`);
    return res.json({ success: true, message: 'Unidade e usuário criados com sucesso', unidade: unidadeData });

  } catch (error) {
    console.error('[Auth] Erro em create-recepcao:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /auth/recepcao/:unidadeId
 * Retorna o e-mail do usuário vinculado à unidade
 */
export async function handleGetRecepcao(req, res) {
  const { unidadeId } = req.params;

  try {
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('unidade_id', unidadeId)
      .eq('role', 'recepcao')
      .single();

    if (roleError || !roleData) {
      return res.status(404).json({ success: false, error: 'Recepção não encontrada para esta unidade.' });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(roleData.user_id);

    if (authError || !authData.user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado no sistema.' });
    }

    return res.json({ success: true, email: authData.user.email });
  } catch (error) {
    console.error('[Auth] Erro em get-recepcao:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * PUT /auth/recepcao/:unidadeId
 * Atualiza os dados da unidade e as credenciais do usuário de recepção
 */
export async function handleUpdateRecepcao(req, res) {
  const { unidadeId } = req.params;
  const {
    email,
    senha,
    nome,
    endereco,
    bairro,
    cidade,
    horario_funcionamento,
    atende_24h,
    whatsapp,
    google_maps_url,
    laboratorio_url,
    servicos
  } = req.body;

  try {
    // 1. Atualizar a tabela unidades
    const { error: unidadeError } = await supabase
      .from('unidades')
      .update({
        nome,
        endereco: endereco || null,
        bairro: bairro || null,
        cidade: cidade || null,
        horario_funcionamento: horario_funcionamento || null,
        atende_24h,
        whatsapp: whatsapp || null,
        google_maps_url: google_maps_url || null,
        laboratorio_url: laboratorio_url || null,
        servicos
      })
      .eq('id', unidadeId);

    if (unidadeError) {
      throw new Error(`Erro ao atualizar unidade: ${unidadeError.message}`);
    }

    // 2. Descobrir o user_id do usuário da recepção
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('unidade_id', unidadeId)
      .eq('role', 'recepcao')
      .limit(1)
      .maybeSingle();

    if (roleError) {
      throw new Error(`Erro ao buscar o usuário da recepção: ${roleError.message}`);
    }

    if (!roleData) {
      // Se não encontrou o usuário, cria um novo se tiver email e senha
      if (email && senha) {
        const { data: unid } = await supabase.from('unidades').select('clinica_id').eq('id', unidadeId).single();
        if (unid) {
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: senha,
            email_confirm: true,
            user_metadata: { role: 'recepcao', clinica_id: unid.clinica_id }
          });
          if (authError) throw new Error(`Erro ao criar credenciais da recepção: ${authError.message}`);
          
          await supabase.from('user_roles').insert({
            user_id: authData.user.id,
            role: 'recepcao',
            clinica_id: unid.clinica_id,
            unidade_id: unidadeId
          });
        }
      }
    } else {
      // 3. Atualizar o e-mail ou a senha no Supabase Auth
      const authUpdates = {};
      if (email) authUpdates.email = email;
      if (senha) authUpdates.password = senha;

      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabase.auth.admin.updateUserById(roleData.user_id, authUpdates);
        if (authError) {
          throw new Error(`Erro ao atualizar credenciais do usuário: ${authError.message}`);
        }
      }
    }

    console.log(`[Auth] Unidade ${nome} (ID: ${unidadeId}) atualizada com sucesso.`);
    return res.json({ success: true, message: 'Unidade atualizada com sucesso' });

  } catch (error) {
    console.error('[Auth] Erro em update-recepcao:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
