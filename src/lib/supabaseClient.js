import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://dnbditgqtoovaiefqfar.supabase.co'
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuYmRpdGdxdG9vdmFpZWZxZmFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0OTk2NjUsImV4cCI6MjA5ODA3NTY2NX0.MvlPmjIo_oOAcoArFcu5LUspksF0OHQRolKYmlXj8-c'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)