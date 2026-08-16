const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

let gapiInitPromise = null;
let gisInitPromise = null;
let tokenClient = null;

function loadGoogleApiScript() {
  if (window.gapi) {
    return Promise.resolve(window.gapi);
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-google-calendar]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.gapi));
      existingScript.addEventListener('error', () => reject(new Error('Google API script failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.dataset.googleCalendar = 'true';
    script.onload = () => resolve(window.gapi);
    script.onerror = () => reject(new Error('Google API script failed to load'));
    document.body.appendChild(script);
  });
}

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve(window.google);
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-google-identity]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.google));
      existingScript.addEventListener('error', () => reject(new Error('Google Identity Services script failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Google Identity Services script failed to load'));
    document.body.appendChild(script);
  });
}

export async function initGoogleCalendarClient() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
    throw new Error('Google Calendar API credentials are not configured. Set REACT_APP_GOOGLE_CLIENT_ID and REACT_APP_GOOGLE_API_KEY.');
  }

  if (!gapiInitPromise) {
    gapiInitPromise = loadGoogleApiScript().then((gapi) => {
      return new Promise((resolve, reject) => {
        gapi.load('client', async () => {
          try {
            await gapi.client.init({
              apiKey: GOOGLE_API_KEY,
              discoveryDocs: DISCOVERY_DOCS,
            });
            resolve(gapi);
          } catch (err) {
            reject(err);
          }
        });
      });
    });
  }

  return gapiInitPromise;
}

async function initGoogleIdentityClient() {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google Calendar client ID is not configured. Set REACT_APP_GOOGLE_CLIENT_ID.');
  }

  if (!gisInitPromise) {
    gisInitPromise = loadGoogleIdentityScript().then((google) => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: () => {},
      });

      return google;
    });
  }

  await gisInitPromise;
  return tokenClient;
}

async function ensureGoogleCalendarAccess({ prompt = '' } = {}) {
  const [gapi] = await Promise.all([initGoogleCalendarClient(), initGoogleIdentityClient()]);
  const existingToken = gapi.client.getToken();

  if (existingToken?.access_token) {
    return existingToken.access_token;
  }

  return new Promise((resolve, reject) => {
    tokenClient.callback = (response) => {
      if (response?.error) {
        reject(response);
        return;
      }

      const accessToken = gapi.client.getToken()?.access_token || response?.access_token;

      if (!accessToken) {
        reject(new Error('Google Calendar sign-in did not return an access token.'));
        return;
      }

      resolve(accessToken);
    };

    try {
      tokenClient.requestAccessToken({ prompt });
    } catch (err) {
      reject(err);
    }
  });
}

async function ensureCalendarApiLoaded() {
  const gapi = await initGoogleCalendarClient();

  if (!gapi.client.calendar) {
    await gapi.client.load('calendar', 'v3');
  }

  return gapi;
}

export async function connectGoogleCalendar() {
  await ensureGoogleCalendarAccess({ prompt: 'consent' });
  return true;
}

/**
 * Synchronous, no-network check for whether we already hold a live access
 * token in memory. Safe to call from anywhere (including background effects)
 * since it never triggers an OAuth flow — Google's consent/token popup can
 * only be opened from a real user gesture, or browsers block it outright.
 */
export function hasGoogleCalendarAccess() {
  return Boolean(window.gapi?.client?.getToken?.()?.access_token);
}

export async function createGoogleCalendarEvent({ summary, description, startDateTime, endDateTime, timeZone }) {
  const gapi = await ensureCalendarApiLoaded();
  await ensureGoogleCalendarAccess();

  const event = {
    summary,
    description,
    start: {
      dateTime: startDateTime,
      timeZone,
    },
    end: {
      dateTime: endDateTime,
      timeZone,
    },
  };

  const response = await gapi.client.calendar.events.insert({
    calendarId: 'primary',
    resource: event,
  });

  return response.result;
}

export async function getGoogleCalendarAvailability({
  timeMin,
  timeMax,
  calendarIds = ['primary'],
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}) {
  if (!timeMin || !timeMax) {
    throw new Error('Google Calendar availability requires both timeMin and timeMax.');
  }

  const gapi = await ensureCalendarApiLoaded();
  await ensureGoogleCalendarAccess();

  const response = await gapi.client.calendar.freebusy.query({
    resource: {
      timeMin,
      timeMax,
      timeZone,
      items: calendarIds.map((id) => ({ id })),
    },
  });

  return response.result?.calendars || {};
}
