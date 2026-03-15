import { supabase } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Login {
  id: string;
  domain: string;
  method: string;
  identifier?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getLoginsForDomain(domain: string): Promise<Login[]> {
  const { data, error } = await supabase
    .from("logins")
    .select("*")
    .eq("domain", domain)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Login[];
}

export async function addLogin(
  domain: string,
  method: string,
  identifier?: string,
  notes?: string
): Promise<Login> {
  const { data, error } = await supabase
    .from("logins")
    .insert({ domain, method, identifier, notes })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Login;
}

export async function updateLogin(
  id: string,
  fields: Partial<Pick<Login, "method" | "identifier" | "notes">>
): Promise<Login> {
  const { data, error } = await supabase
    .from("logins")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Login;
}

export async function deleteLogin(id: string): Promise<void> {
  const { error } = await supabase.from("logins").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
