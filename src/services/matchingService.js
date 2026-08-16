import { supabase } from '../supabaseClient';

/**
 * Runs the per-student matching function for a single user (rematch_student
 * RPC). Additive-only and idempotent — safe to call repeatedly and never
 * touches another student's existing group membership.
 *
 * @param {string} userId
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function rematchStudent(userId) {
  if (!userId) return { ok: false, error: 'User ID is required' };

  const { error } = await supabase.rpc('rematch_student', { p_user_id: userId });

  if (error) {
    console.error('rematch_student RPC error:', error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
