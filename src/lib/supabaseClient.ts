import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kssqjjcqkpukdbcxmlgc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzc3FqamNxa3B1a2RiY3htbGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjkyNjksImV4cCI6MjA5MjIwNTI2OX0.a66RWuQ353BWwxNBnjceQJg3v1bAiR9zIUEFEuYo40A';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
