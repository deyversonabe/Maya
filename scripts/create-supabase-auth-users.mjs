#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const recoveryAdminEmail = process.env.MAYA_RECOVERY_ADMIN_EMAIL || "deyversonsilvaf@gmail.com";
const allowWeakInitialPasswords = process.env.MAYA_ALLOW_WEAK_INITIAL_PASSWORDS === "true";
const updateExistingPasswords = process.env.MAYA_UPDATE_EXISTING_PASSWORDS === "true";

const users = [
  {
    username: "Deyveron",
    email: process.env.MAYA_DEYVERON_EMAIL || recoveryAdminEmail,
    password: process.env.MAYA_DEYVERON_PASSWORD
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

for (const user of users) {
  await upsertAuthUser(user);
}

console.log("Usuarios iniciais processados com sucesso.");

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
    return;
  }

  const { error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: userMetadata
  });

  if (error) {
    throw new Error(`Nao foi possivel criar ${user.username}: ${error.message}`);
  }

  console.log(`Criado: ${user.username} <${maskEmail(user.email)}>.`);
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
