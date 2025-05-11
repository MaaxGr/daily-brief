import fs from 'fs/promises';
import path from 'path';
import express, { Request, Response } from 'express';
import { GoogleAuthClient } from './GoogleAuthClient';
import { MSAuthClient } from './MSAuthClient';
import { EventLoader } from './EventLoader';
import * as dotenv from "dotenv";
import axios from 'axios';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const googleAuthClient = new GoogleAuthClient();
const msAuthClient = new MSAuthClient();
const eventLoader = new EventLoader(msAuthClient, googleAuthClient);


app.get("/authorize/microsoft", async (_req, res) => {
    res.redirect(msAuthClient.getAuthorizeUrl());
});

app.get('/authorize/google', async (_req, res) => {
    res.redirect(googleAuthClient.getAuthorizeUrl());
});

app.get('/events', async (_req, res) => {
    if (!googleAuthClient.authenticated) {
        res.status(500).send("Google API is not initialized!")
        return;
    }

    const events = await eventLoader.getGoogleEvents()
    res.json(events);
});

app.get('/events/ms', async (_req, res) => {
    if (!googleAuthClient.authenticated) {
        res.status(500).send("Google API is not initialized!")
        return;
    }

    let events = await eventLoader.getMSTodaysEvents()
    res.json(events);
});

app.get("/prompt", async (req, res) => {
    let preText = "Fasse den heutigen Tag zusammen basierend auf folgende Jsons. Formulare den Text so, dass ich ihn einem Text to speech model geben kann. "
    preText += "Es werden 2 JSONs geliefert. Einer mit privaten Terminen und der andere mit Terminen von der Arbeit. Bitte fasse alles in einen Text zusammen. "
    preText += "Es ist wichtig, dass du zwischen 'kleinem Besprechungzimmer' und 'großem Besprechungzimmer' unterscheidest."

    const googleEvents = await eventLoader.getGoogleEvents();
    preText += "\nPrivat:\n" + JSON.stringify(googleEvents);

    const msEvents = await eventLoader.getMSTodaysEvents();
    preText += "\nArbeit:\n" + JSON.stringify(msEvents);

    try {
        const chatGptResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    { role: "system", content: "You are a helpful assistant." },
                    { role: "user", content: preText }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const firstChoiceContent = chatGptResponse.data.choices[0]?.message?.content;
        //res.send(firstChoiceContent || "No content returned from ChatGPT.");

        // Step 2: Send the response to ElevenLabs
        const elevenLabsResponse = await axios.post(
            'https://api.elevenlabs.io/v1/text-to-speech/MbbPUteESkJWr4IAaW35',
            {
                text: firstChoiceContent,
                model_id: "eleven_flash_v2_5",
                language_code: "de",
            },
            {
                headers: {
                    accept: 'audio/mpeg',
                    'xi-api-key': process.env.ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                },
                responseType: 'stream' // To handle audio file response
            }
        );

        // Step 3: Send the audio file back to the client
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');

        elevenLabsResponse.data.pipe(res);

    } catch (error: any) {
        console.log("Error communicating with ElevenLabs API:", error.message);
        console.error("Error communicating with ChatGPT API:", error.response?.data || error.message);
        res.status(500).send("Failed to communicate with ChatGPT API.");
    }
});


app.get('/auth/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;

    if (!code) {
        res.status(400).send('Missing code');
        return
    }

    try {
        await googleAuthClient.handleAuthorizeCallback(code);
        res.send('✅ Authorization successful. You can now call /events');
    } catch (err) {
        console.error('Token error:', err);
        res.status(500).send('Failed to get token');
    }
});

app.get("/auth/entra/callback", async (req: Request, res: Response) => {
    const code = req.query.code;

    if (!code) {
        res.status(400).send('Missing code');
        return
    }

    try {
        const response = await msAuthClient.handleAuthorizeCallback(code as string)
        res.send(`Access token: ${response.access_token}<br>Refresh token: ${response.refresh_token}`);
    } catch (error: any) {
        console.error(error.response?.data || error.message);
        res.status(500).send("Error getting token.");
    }
});

app.listen(port, async () => {
    console.log(`🚀 Server running: http://localhost:${port}`);

    await googleAuthClient.initClient();
    await googleAuthClient.authenticateSilent();
    await msAuthClient.readTokensFromFile();
});

