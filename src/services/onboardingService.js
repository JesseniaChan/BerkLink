import { supabase } from '../supabaseClient';

/**
 * Saves onboarding data to Supabase 'students' table
 * Automatically creates a new row if user has no existing data
 * Updates only the fields that changed if row exists
 * Uses upsert() to handle both insert and update scenarios
 *
 * @param {string} userId - The authenticated user's ID (auth.uid())
 * @param {object} data - The onboarding data to save (e.g., { instagram, phone, classes, availability })
 * @param {string} tableName - The table name (default: 'students')
 * @returns {Promise<object>} - The saved row data from Supabase
 * @throws {Error} - If save operation fails
 */
export async function saveOnboardingData(userId, data, tableName = 'students') {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Data must be a valid object');
  }

  try {
    // Prepare the data with user_id and timestamp
    const dataToSave = {
      user_id: userId,
      ...data,
      updated_at: new Date().toISOString(),
    };

    // Add created_at only if it's a new row (will be ignored on update)
    if (!dataToSave.created_at) {
      dataToSave.created_at = new Date().toISOString();
    }

    // Use upsert() to automatically handle insert or update
    // If user_id already exists, it updates those fields
    // If user_id doesn't exist, it creates a new row
    const { data: savedData, error: upsertError } = await supabase
      .from(tableName)
      .upsert(dataToSave, { onConflict: 'user_id' })
      .select()
      .single();

    if (upsertError) {
      console.error(`Error saving to ${tableName}:`, upsertError);
      throw new Error(upsertError.message || `Failed to save to ${tableName}`);
    }

    if (!savedData) {
      throw new Error('No data returned from save operation');
    }

    console.log(`Successfully saved onboarding data for user ${userId}:`, savedData);
    return savedData;
  } catch (err) {
    console.error('Onboarding data save error:', err);
    throw err;
  }
}

/**
 * Retrieves existing onboarding data for a user
 * Useful for checking what data has already been saved
 *
 * @param {string} userId - The authenticated user's ID
 * @param {string} tableName - The table name (default: 'students')
 * @returns {Promise<object|null>} - The user's row data or null if doesn't exist
 */
export async function getOnboardingData(userId, tableName = 'students') {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows found" - that's okay
      console.error(`Error retrieving from ${tableName}:`, error);
      throw error;
    }

    return data || null;
  } catch (err) {
    console.error('Onboarding data retrieval error:', err);
    throw err;
  }
}

/**
 * Updates only specific fields in the onboarding data
 * Without affecting other fields that have already been saved
 *
 * @param {string} userId - The authenticated user's ID
 * @param {object} fieldsToUpdate - Only the fields to update (e.g., { phone: '5551234567' })
 * @param {string} tableName - The table name (default: 'students')
 * @returns {Promise<object>} - The updated row data
 */
export async function updateOnboardingFields(userId, fieldsToUpdate, tableName = 'students') {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!fieldsToUpdate || typeof fieldsToUpdate !== 'object') {
    throw new Error('Fields to update must be a valid object');
  }

  try {
    // Add updated_at to the fields
    const updateData = {
      ...fieldsToUpdate,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedData, error: updateError } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('user_id', userId)
      .select();

    if (updateError) {
      console.error(`Error updating ${tableName}:`, updateError);
      throw new Error(updateError.message || `Failed to update ${tableName}`);
    }

    if (!updatedData || updatedData.length === 0) {
      throw new Error('No data returned from update operation');
    }

    console.log(`Successfully updated onboarding data for user ${userId}:`, updatedData[0]);
    return updatedData[0];
  } catch (err) {
    console.error('Onboarding data update error:', err);
    throw err;
  }
}

/**
 * Saves data for a specific onboarding step
 * Merges new data with existing data without overwriting other fields
 *
 * @param {string} userId - The authenticated user's ID
 * @param {object} stepData - The data for this specific step
 * @param {string} tableName - The table name (default: 'students')
 * @returns {Promise<object>} - The complete saved row data
 */
export async function saveOnboardingStep(userId, stepData, tableName = 'students') {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // First, get existing data if any
    const existingData = await getOnboardingData(userId, tableName);

    // Merge existing data with new step data
    const mergedData = {
      ...(existingData || {}),
      ...stepData,
    };

    // Save the merged data using upsert
    return await saveOnboardingData(userId, mergedData, tableName);
  } catch (err) {
    console.error('Onboarding step save error:', err);
    throw err;
  }
}

/**
 * Marks onboarding as complete for a user
 * Updates the onboarding_complete flag and sets completion timestamp
 *
 * @param {string} userId - The authenticated user's ID
 * @param {string} tableName - The table name (default: 'students')
 * @returns {Promise<object>} - The updated row data
 */
export async function markOnboardingComplete(userId, tableName = 'students') {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Get existing data
    const existingData = await getOnboardingData(userId, tableName);

    // Mark onboarding as complete
    const completionData = {
      ...(existingData || {}),
      onboarding_complete: true,
      onboarding_completed_at: new Date().toISOString(),
    };

    // Save using upsert
    return await saveOnboardingData(userId, completionData, tableName);
  } catch (err) {
    console.error('Error marking onboarding complete:', err);
    throw err;
  }
}
