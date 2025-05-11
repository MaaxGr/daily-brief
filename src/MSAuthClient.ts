
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from "@azure/identity";
import path from 'path';
import axios from 'axios'
import qs from 'qs'
import fs from 'fs/promises';


console.log("xxx" + process.env.MS_TENANT_ID)


const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000;

export class MSAuthClient {

    tenantId!: string;
    entraAppId!: string;
    entraSecret!: string;
    msScopes!: string;
    msRedirect: string;
    credential!: ClientSecretCredential
    tokenData!: any

    constructor() {
        this.tenantId = process.env.MS_TENANT_ID!
        this.entraAppId = process.env.MS_APP_ID!
        this.entraSecret = process.env.MS_APP_SECRET!
        this.msScopes = "offline_access Calendars.Read";
        this.msRedirect = process.env.MS_REDIRECT_URL!
        this.credential = new ClientSecretCredential(this.tenantId, this.entraAppId, this.entraSecret);
    }


    getAuthorizeUrl() {
        const params = new URLSearchParams({
            client_id: this.entraAppId,
            response_type: "code",
            redirect_uri: this.msRedirect,
            response_mode: "query",
            scope: this.msScopes,
        });

        return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params.toString()}`
    }

    async readTokensFromFile() {
        const tokenPath = path.join(__dirname, "../ms-tokens.json");
        const fileContent = await fs.readFile(tokenPath, "utf-8");
        this.tokenData = JSON.parse(fileContent); // 👉 parsed to object
    }

    async getValidAccessToken() {
        const now = Date.now();

        if (now >= this.tokenData.expires_at - TOKEN_EXPIRY_BUFFER) {
            // Token expired or about to expire, refresh it
            this.tokenData = await this.refreshAccessToken(this.tokenData.refresh_token);
        }

        return this.tokenData.access_token;
    }

    async refreshAccessToken(refreshToken: string) {
        const tokenEndpoint = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;

        try {
            const response = await axios.post(
                tokenEndpoint,
                qs.stringify({
                    client_id: this.entraAppId,
                    client_secret: this.entraSecret,
                    grant_type: "refresh_token",
                    refresh_token: refreshToken,
                    scope: this.msScopes,
                }),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                }
            );

            const { access_token, refresh_token, expires_in } = response.data;

            const tokenData = {
                access_token,
                refresh_token,
                expires_at: Date.now() + expires_in * 1000, // Store for auto-renewal
            };

            const tokenPath = path.join(__dirname, "../ms-tokens.json");
            fs.writeFile(tokenPath, JSON.stringify(tokenData, null, 2));
            return tokenData;
        } catch (err: any) {
            console.error("Failed to refresh access token:", err.response?.data || err.message);
            throw err;
        }
    }


    async handleAuthorizeCallback(code: string) {
        const response = await axios.post(
            `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
            qs.stringify({
                client_id: this.entraAppId,
                client_secret: this.entraSecret,
                code,
                redirect_uri: this.msRedirect,
                grant_type: "authorization_code",
                scope: this.msScopes,
            }),
            {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            }
        );

        const { access_token, refresh_token, expires_in } = response.data;

        const tokenData = {
            access_token,
            refresh_token,
            expires_at: Date.now() + expires_in * 1000,
        };

        const tokenPath = path.join(__dirname, "../ms-tokens.json");
        fs.writeFile(tokenPath, JSON.stringify(tokenData, null, 2));


        return response.data;
    }

    async getMSGraphClient(accessToken: string) {
        return Client.init({
            authProvider: (done) => {
                done(null, accessToken);
            },
        });
    }

}