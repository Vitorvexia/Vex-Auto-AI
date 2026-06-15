"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { getServerStoreId } from "@/lib/auth";

export async function createVehicle(formData: FormData): Promise<void> {
  const storeId = await getServerStoreId();

  const marca = (formData.get("marca") as string | null)?.trim() ?? "";
  const modelo = (formData.get("modelo") as string | null)?.trim() ?? "";
  const anoStr = (formData.get("ano") as string | null) ?? "";
  const precoStr = (formData.get("preco") as string | null) ?? "";
  const custoStr = (formData.get("custo") as string | null) ?? "";
  const margemStr = (formData.get("margem_minima") as string | null) ?? "0";

  if (!marca || !modelo || !anoStr || !precoStr || !custoStr) {
    throw new Error("Campos obrigatórios ausentes");
  }

  const ano = parseInt(anoStr, 10);
  const preco = parseFloat(precoStr);
  const custo = parseFloat(custoStr);
  const margem_minima = parseFloat(margemStr) || 0;

  if (isNaN(ano) || isNaN(preco) || isNaN(custo)) {
    throw new Error("Valores numéricos inválidos");
  }

  if (preco <= custo) {
    throw new Error("Preço deve ser maior que o custo");
  }
  if (margem_minima > preco - custo) {
    throw new Error("Margem mínima não pode ser maior que o lucro bruto (preço − custo)");
  }

  const { error } = await supabaseAdmin.from("vehicles").insert({
    store_id: storeId,
    marca,
    modelo,
    ano,
    preco,
    custo,
    margem_minima,
  });

  if (error) throw error;
  revalidatePath("/estoque");
}

export async function updateVehicle(vehicleId: string, formData: FormData): Promise<void> {
  const storeId = await getServerStoreId();

  const { data: check } = await supabaseAdmin
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (!check) throw new Error("Veículo não encontrado");

  const marca = (formData.get("marca") as string | null)?.trim() ?? "";
  const modelo = (formData.get("modelo") as string | null)?.trim() ?? "";
  const anoStr = (formData.get("ano") as string | null) ?? "";
  const precoStr = (formData.get("preco") as string | null) ?? "";
  const custoStr = (formData.get("custo") as string | null) ?? "";
  const margemStr = (formData.get("margem_minima") as string | null) ?? "0";

  if (!marca || !modelo || !anoStr || !precoStr || !custoStr) {
    throw new Error("Campos obrigatórios ausentes");
  }

  const preco = parseFloat(precoStr);
  const custo = parseFloat(custoStr);
  const margem_minima = parseFloat(margemStr) || 0;
  const ano = parseInt(anoStr, 10);

  if (isNaN(ano) || isNaN(preco) || isNaN(custo)) throw new Error("Valores numéricos inválidos");
  if (preco <= custo) {
    throw new Error("Preço deve ser maior que o custo");
  }
  if (margem_minima > preco - custo) {
    throw new Error("Margem mínima não pode ser maior que o lucro bruto (preço − custo)");
  }

  const { error } = await supabaseAdmin
    .from("vehicles")
    .update({
      marca,
      modelo,
      ano,
      preco,
      custo,
      margem_minima,
    })
    .eq("id", vehicleId)
    .eq("store_id", storeId);

  if (error) throw error;
  revalidatePath("/estoque");
}

export async function archiveVehicle(vehicleId: string, _formData?: FormData): Promise<void> {
  const storeId = await getServerStoreId();

  const { data: check } = await supabaseAdmin
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (!check) throw new Error("Veículo não encontrado");

  const { error } = await supabaseAdmin
    .from("vehicles")
    .update({ disponivel: false })
    .eq("id", vehicleId)
    .eq("store_id", storeId);

  if (error) throw error;
  revalidatePath("/estoque");
}

export async function unarchiveVehicle(vehicleId: string, _formData?: FormData): Promise<void> {
  const storeId = await getServerStoreId();

  const { data: check } = await supabaseAdmin
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (!check) throw new Error("Veículo não encontrado");

  const { error } = await supabaseAdmin
    .from("vehicles")
    .update({ disponivel: true })
    .eq("id", vehicleId)
    .eq("store_id", storeId);

  if (error) throw error;
  revalidatePath("/estoque");
}
