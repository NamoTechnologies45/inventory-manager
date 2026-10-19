import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export async function uploadPDFAndGetLink(pdfBlob, fileName) {
  const { data, error } = await supabase.storage
    .from('bills')
    .upload(`pdfs/${fileName}`, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true
    })

  if (error) throw error

  const { data: urlData } = supabase.storage
    .from('bills')
    .getPublicUrl(`pdfs/${fileName}`)

  return urlData.publicUrl
}
export const supabase = createClient(supabaseUrl, supabaseKey)