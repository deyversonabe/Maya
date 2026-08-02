#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const recoveryAdminEmail = process.env.MAYA_RECOVERY_ADMIN_EMAIL || "deyversonsilvaf@gmail.com";
const workspaceId = process.env.MAYA_WORKSPACE_ID || "00000000-0000-4000-8000-000000000001";
const allowWeakInitialPasswords = process.env.MAYA_ALLOW_WEAK_INITIAL_PASSWORDS === "true";
const updateExistingPasswords = process.env.MAYA_UPDATE_EXISTING_PASSWORDS === "true";

const users = [
  {
    username: "Deyverson",
    email: process.env.MAYA_DEYVERSON_EMAIL || process.env.MAYA_DEYVERON_EMAIL || recoveryAdminEmail,
    password: process.env.MAYA_DEYVERSON_PASSWORD || process.env.MAYA_DEYVERON_PASSWORD
  },
  {
    username: "Tom",
    email: process.env.MAYA_TOM_EMAIL,
    password: process.env.MAYA_TOM_PASSWORD
  }
];

assertEnv("SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
assertEnv("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey);

for (const user of users) {
  assertEnv(`e-mail do usuario ${user.username}`, user.email);
  assertEnv(`senha do usuario ${user.username}`, user.password);

  if ((user.password?.length ?? 0) < 6 && !allowWeakInitialPasswords) {
    throw new Error(
      [
        `A senha inicial de ${user.username} tem menos de 6 caracteres.`,
        "Para dados financeiros reais, use uma senha forte.",
        "Se for apenas um bootstrap temporario e voce aceitar o risco, rode com MAYA_ALLOW_WEAK_INITIAL_PASSWORDS=true."
      ].join(" ")
    );
  }
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

await ensureSharedWorkspace();

for (const user of users) {
  const authUser = await upsertAuthUser(user);
  await ensureWorkspaceMember(authUser.id, isAdminEmail(user.email) ? "admin" : "member");
}

console.log("Usuarios iniciais e acesso compartilhado processados com sucesso.");

async function ensureSharedWorkspace() {
  const initialState = {
    schemaVersion: 6,
    profile: {
      name: "Maya",
      slogan: "Organizar hoje. Construir o amanha.",
      monthlyIncomeTarget: 0,
      emergencyReserveTarget: 0
    },
    accounts: [],
    transactions: [],
    goals: [],
    budgets: [],
    bills: [],
    taxDocuments: [],
    laborBenefits: [],
    payrollRecords: [],
    workTimeEntries: [],
    activityLogs: [],
    deletedEntityIds: [],
    updatedAt: new Date().toISOString()
  };

  const { error: workspaceError } = await supabase
    .from("finance_workspaces")
    .upsert({ id: workspaceId, name: "MAYA" }, { onConflict: "id" });

  if (workspaceError) {
    throw new Error(
      `Nao foi possivel preparar o workspace compartilhado. Execute a migracao 20260719_shared_finance_workspace.sql. Detalhe: ${workspaceError.message}`
    );
  }

  const { error: stateError } = await supabase.from("finance_workspace_states").upsert(
    {
      workspace_id: workspaceId,
      state: initialState
    },
    { onConflict: "workspace_id", ignoreDuplicates: true }
  );

  if (stateError) {
    throw new Error(`Nao foi possivel preparar a base compartilhada: ${stateError.message}`);
  }
}

async function upsertAuthUser(user) {
  const existing = await findUserByEmail(user.email);
  const userMetadata = {
    username: user.username,
    display_name: user.username,
    recovery_admin_email: recoveryAdminEmail
  };

  if (existing) {
    const updatePayload = {
      user_metadata: {
        ...(existing.user_metadata || {}),
        ...userMetadata
      }
    };

    if (updateExistingPasswords) {
      updatePayload.password = user.password;
    }

    const { error } = await supabase.auth.admin.updateUserById(existing.id, updatePayload);

    if (error) {
      throw new Error(`Nao foi possivel atualizar ${user.username}: ${error.message}`);
    }

    const passwordNote = updateExistingPasswords ? "senha atualizada" : "senha mantida";
    console.log(`Atualizado: ${user.username} <${maskEmail(user.email)}> (${passwordNote}).`);
    return existing;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: userMetadata
  });

  if (error) {
    throw new Error(`Nao foi possivel criar ${user.username}: ${error.message}`);
  }

  if (!data.user) {
    throw new Error(`Usuario ${user.username} foi criado sem retorno de identificador.`);
  }

  console.log(`Criado: ${user.username} <${maskEmail(user.email)}>.`);
  return data.user;
}

async function ensureWorkspaceMember(userId, role) {
  const { error } = await supabase.from("finance_workspace_members").upsert(
    {
      workspace_id: workspaceId,
      user_id: userId,
      role
    },
    { onConflict: "workspace_id,user_id" }
  );

  if (error) {
    throw new Error(`Nao foi possivel liberar acesso compartilhado para o usuario: ${error.message}`);
  }

  console.log(`Acesso compartilhado liberado como ${role}.`);
}

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 1000;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Nao foi possivel listar usuarios: ${error.message}`);
    }

    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

    if (found) {
      return found;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }

  throw new Error("Limite de varredura de usuarios atingido. Crie ou edite o usuario pelo painel do Supabase.");
}

function assertEnv(name, value) {
  if (!value) {
    throw new Error(`Configure ${name} antes de rodar este script.`);
  }
}

function maskEmail(email) {
  const [name, domain] = email.split("@");

  if (!domain) {
    return email;
  }

  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, name.length - visible.length))}@${domain}`;
}

function isAdminEmail(email) {
  return email?.trim().toLowerCase() === "deyversonsilvaf@gmail.com";
}
