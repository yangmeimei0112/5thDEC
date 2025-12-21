const SUPABASE_URL = 'https://hodalinmmhmukpjzxill.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvZGFsaW5tbWhtdWtwanp4aWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyOTA1OTksImV4cCI6MjA3OTg2NjU5OX0.E4-HvFhuNG9p0FoXAbedTFTU5y6uFTuuZ7BnuxUn-vc'; 
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);