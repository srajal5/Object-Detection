import { supabase } from './supabase';
import { Database } from '@/lib/types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export async function createProfile(userId: string, email: string) {
  // First insert the profile
  const { error: insertError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: email,
    } as Database['public']['Tables']['profiles']['Insert']);

  if (insertError) {
    console.error('Error creating profile:', insertError);
    throw insertError;
  }

  // Then fetch the created profile
  const { data, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError) {
    console.error('Error fetching created profile:', fetchError);
    throw fetchError;
  }

  return data;
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }

  return data;
} 