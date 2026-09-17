// Configuration des clés d'accès Supabase
const SUPABASE_URL = "https://emvuqpgznlsbqgvqmpiy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtdnVxcGd6bmxzYnFndnFtcGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NjY1MTIsImV4cCI6MjEwNTI0MjUxMn0.o_wmu8GGGZfakIKIGPuW53IrBQsBNCa5YpVyZGvIEJI";

// Initialisation du client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);