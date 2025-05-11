import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(__dirname, '../token.json');
const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

export class GoogleAuthClient {

    public oauth2Client!: OAuth2Client;
    public authenticated = false

    async initClient() {
        const content = await fs.readFile(CREDENTIALS_PATH, 'utf8');
        const credentials = JSON.parse(content).web;
        const { client_id, client_secret, redirect_uris } = credentials;

        this.oauth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            process.env.GOOGLE_REDIRECT_URL!
        );
    }

    getAuthorizeUrl() {
        const url = this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent',
            redirect_uri: process.env.GOOGLE_REDIRECT_URL!
        });
        return url;
    }

    async handleAuthorizeCallback(code: string) {
        const { tokens } = await this.oauth2Client.getToken(code);
        await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        this.authenticateSilent();
    }

    async authenticateSilent() {
        try {
            // Attempt to load token
            const token = await this.loadToken();

            if (!token || !token.access_token || !token.refresh_token) {
                throw new Error(
                    '❌ No valid token found. Manual re-authentication required.'
                );
            }

            this.oauth2Client.setCredentials(token);
            this.setupAutoRefresh();

            this.authenticated = true;
            console.log("Authenticated!")
        } catch (ex) {
            this.authenticated = false;
            console.log("Could not initialize google client. Maybe you should have to invoke /auth manually")
        }
    }

    private async loadToken() {
        try {
            const token = await fs.readFile(TOKEN_PATH, 'utf8');
            return JSON.parse(token);
        } catch {
            return null;
        }
    }

    private setupAutoRefresh() {
        this.oauth2Client!!.on('tokens', async (tokens) => {
            if (tokens.access_token || tokens.refresh_token) {
                const merged = {
                    ...this.oauth2Client!!.credentials,
                    ...tokens,
                };
                await fs.writeFile(TOKEN_PATH, JSON.stringify(merged, null, 2));
                console.log('🔁 Refreshed token saved.');
            }
        });
    }

    async init() {
        try {
            const content = await fs.readFile(CREDENTIALS_PATH, 'utf8');
            const credentials = JSON.parse(content).web;
            const { client_id, client_secret, redirect_uris } = credentials;

            this.oauth2Client = new google.auth.OAuth2(
                client_id,
                client_secret,
                process.env.GOOGLE_REDIRECT_URL!
            );
            this.oauth2Client.on('tokens', (newTokens) => {
                if (newTokens.refresh_token || newTokens.access_token) {
                    const updatedTokens = {
                        ...this.oauth2Client!!.credentials,
                        ...newTokens,
                    };
                    fs.writeFile('token.json', JSON.stringify(updatedTokens, null, 2));
                }
            });

            const token = await fs.readFile(TOKEN_PATH, 'utf8');
            this.oauth2Client.setCredentials(JSON.parse(token));

        } catch (ex) {
            console.log("Could not initialize google client. Maybe you should have to invoke /auth manually")
        }
    }

}