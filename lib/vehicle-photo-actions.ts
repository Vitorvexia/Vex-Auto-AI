"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { getServerStoreId } from "@/lib/auth";
import {
  VEHICLE_PHOTOS_BUCKET,
  validatePhotoBatch,
  buildVehiclePhotoPath,
} from "@/lib/vehicle-photos";

/**
 * Sobe fotos novas pro Storage e concatena as URLs públicas ao array
 * existente (`vehicles.photo_url`). Nunca substitui — primeira posição do
 * array continua sendo a capa, mesmo depois de uploads incrementais.
 */
export async function uploadVehiclePhotos(
  vehicleId: string,
  formData: FormData
): Promise<void> {
  const storeId = await getServerStoreId();

  const { data: vehicle } = await supabaseAdmin
    .from("vehicles")
    .select("id, photo_url")
    .eq("id", vehicleId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!vehicle) throw new Error("Veículo não encontrado");

  const existingPhotos: string[] = vehicle.photo_url ?? [];

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const check = validatePhotoBatch(
    existingPhotos.length,
    files.map((f) => ({ type: f.type, size: f.size, name: f.name }))
  );
  if (!check.ok) throw new Error(check.error);

  const uploadedUrls: string[] = [];
  for (const file of files) {
    const path = buildVehiclePhotoPath(storeId, vehicleId, file.name);
    const { error: uploadError } = await supabaseAdmin.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(`Falha ao subir foto: ${uploadError.message}`);

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .getPublicUrl(path);
    uploadedUrls.push(publicUrlData.publicUrl);
  }

  const { error: updateError } = await supabaseAdmin
    .from("vehicles")
    .update({ photo_url: [...existingPhotos, ...uploadedUrls] })
    .eq("id", vehicleId)
    .eq("store_id", storeId);
  if (updateError) throw updateError;

  revalidatePath("/estoque");
}
