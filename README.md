# Daily Brief

## Overview

Daily Brief is a Node.js application designed to summarize daily events from both personal and work calendars. It integrates with Google Calendar and Microsoft Outlook Calendar to fetch events, processes the data, and generates a summarized text. The summarized text can then be converted into an audio file using ElevenLabs' Text-to-Speech API.

## Features

- **Google Calendar Integration**: Fetches personal events using the Google Calendar API.
- **Microsoft Outlook Calendar Integration**: Fetches work events using the Microsoft Graph API.
- **Event Summarization**: Combines events from both calendars into a single summarized text.
- **Text-to-Speech Conversion**: Converts the summarized text into an audio file using ElevenLabs' API.
- **OAuth2 Authentication**: Supports OAuth2 flows for both Google and Microsoft accounts.
- **Token Management**: Automatically refreshes access tokens for seamless API access.

## Endpoints

- **`/authorize/google`**: Redirects to Google OAuth2 authorization page.
- **`/authorize/microsoft`**: Redirects to Microsoft OAuth2 authorization page.
- **`/auth/callback`**: Handles Google OAuth2 callback.
- **`/auth/entra/callback`**: Handles Microsoft OAuth2 callback.
- **`/events`**: Fetches events from Google Calendar.
- **`/events/ms`**: Fetches events from Microsoft Outlook Calendar.
- **`/prompt`**: Summarizes events and generates an audio file.

## Setup

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd daily-brief
2. **Install Dependencies:**
    ```bash
    npm install
    ```
3. **Configure Environment Variables:** Create a .env file in the root directory and add the following:
    ```
    PORT=3000
    GOOGLE_REDIRECT_URL=http://localhost:3000/auth/callback
    MS_TENANT_ID=<your-tenant-id>
    MS_APP_ID=<your-app-id>
    MS_APP_SECRET=<your-app-secret>
    MS_REDIRECT_URL=http://localhost:3000/auth/entra/callback
    OPENAI_API_KEY=<your-openai-api-key>
    ELEVENLABS_API_KEY=<your-elevenlabs-api-key>
    TZ=Europe/Berlin
    ```
4. **Run the Application:**
    ```
    npm run dev
    ```

5. **Access the Application:** Open your browser and navigate to http://localhost:3000.

## Dependencies

* Node.js: Backend runtime.
* Express: Web framework.
* Axios: HTTP client for API requests.
* Google APIs: Integration with Google Calendar.
* Microsoft Graph Client: Integration with Microsoft Outlook Calendar.
* Luxon: Date and time manipulation.
* dotenv: Environment variable management.