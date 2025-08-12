// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabase = null
let enabled = false

if (url && key) {
  try {
    supabase = createClient(url, key)
    enabled = true
  } catch (e) {
    console.error('Supabase init failed:', e)
    supabase = null
    enabled = false
  }
} else {
  console.warn('Supabase disabled: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

export { supabase, enabled }
