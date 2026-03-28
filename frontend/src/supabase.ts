import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'sua-url-do-supabase';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sua-chave-anon-do-supabase';

// Aqui criamos a conexão mestra com a nuvem do Supabase
export const supabase = createClient(supabaseUrl, supabaseKey);
