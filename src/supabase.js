import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://klqqpybmdqtytmqfdbdk.supabase.co"
const supabaseKey = "sb_publishable_XdkhlRxR_eZubHjF2wBaTQ_b8CWMNWk"

export const supabase = createClient(supabaseUrl, supabaseKey)