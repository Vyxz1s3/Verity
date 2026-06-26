import axios from 'axios';
import { logger } from '../utils/logger.js';

const ERLC_API_BASE = 'https://api.policeroleplay.community/v1';

/**
 * Execute a command on the ER:LC server
 * @param {string} apiKey - Server API key
 * @param {string} command - Command to execute (e.g., ":load username")
 * @returns {Promise<Object>} API response
 */
export async function executeCommand(apiKey, command) {
  try {
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    const response = await axios.post(
      `${ERLC_API_BASE}/commands`,
      { command },
      {
        headers: {
          'server-key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    logger.info(`✅ ERLC Command executed: ${command}`);
    return { success: true, data: response.data };
  } catch (error) {
    logger.error(`❌ ERLC Command failed: ${command}`, error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Load (respawn) a user
 */
export async function loadUser(apiKey, username) {
  return executeCommand(apiKey, `:load ${username}`);
}

/**
 * Refresh a user
 */
export async function refreshUser(apiKey, username) {
  return executeCommand(apiKey, `:refresh ${username}`);
}

/**
 * Kick a user
 */
export async function kickUser(apiKey, username, reason = '') {
  const cmd = reason ? `:kick ${username} ${reason}` : `:kick ${username}`;
  return executeCommand(apiKey, cmd);
}

/**
 * Ban a user
 */
export async function banUser(apiKey, username, reason = '') {
  const cmd = reason ? `:ban ${username} ${reason}` : `:ban ${username}`;
  return executeCommand(apiKey, cmd);
}

/**
 * Give admin permissions
 */
export async function giveAdmin(apiKey, username) {
  return executeCommand(apiKey, `:admin ${username}`);
}

/**
 * Give moderator permissions
 */
export async function giveMod(apiKey, username) {
  return executeCommand(apiKey, `:mod ${username}`);
}

/**
 * Give helper permissions
 */
export async function giveHelper(apiKey, username) {
  return executeCommand(apiKey, `:helper ${username}`);
}

/**
 * Teleport a user to another user
 */
export async function teleportUser(apiKey, username, targetUsername) {
  return executeCommand(apiKey, `:tp ${username} ${targetUsername}`);
}

/**
 * Set peace timer
 */
export async function setPeaceTimer(apiKey, minutes) {
  return executeCommand(apiKey, `:pt ${minutes}`);
}

