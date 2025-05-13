
import { DateTime } from 'luxon'
import { MSAuthClient } from './MSAuthClient';
import { google } from 'googleapis';
import { GoogleAuthClient } from './GoogleAuthClient';

export class EventLoader {

    constructor(
        private msAuthClient: MSAuthClient,
        private googleAuthClient: GoogleAuthClient,
    ) {

    }

    extractGoogleEventData(events: any[]) {
        return events.map(e => {
            let start = e.start.dateTime || e.start.date || '';
            let end = e.end.dateTime || e.end.date || ''
            const isAllDay = !!e.start.date;

            if (isAllDay) {
                let endDate = new Date(end);
                endDate.setDate(endDate.getDate() - 1); // -1 Tag
                end = endDate.toISOString().split('T')[0]
            } else {
                start = DateTime.fromISO(start, { zone: process.env.TZ }).toFormat("yyyy-MM-dd'T'HH:mm:ss");
                end = DateTime.fromISO(end, { zone: process.env.TZ }).toFormat("yyyy-MM-dd'T'HH:mm:ss");
            }

            return {
                title: e.summary || '(No Title)',
                start: start,
                end: end
            }
        });
    }

    extractMSEventData(events: any[]) {
        return events.map(e => {
            const startUTC = DateTime.fromISO(e.start.dateTime, { zone: 'utc' });
            let endUTC = DateTime.fromISO(e.end.dateTime, { zone: 'utc' });

            console.log(e.isAllDay)
            const isAllDay = e.isAllDay === true;
            let start = startUTC.setZone(process.env.TZ).toFormat("yyyy-MM-dd'T'HH:mm:ss");
            let end = endUTC.setZone(process.env.TZ).toFormat("yyyy-MM-dd'T'HH:mm:ss");

            if (isAllDay && endUTC != null) {
                endUTC = endUTC.minus({ days: 1 });
                end = endUTC.toISO()!!.split('T')[0]
                start = startUTC.toISO()!!.split('T')[0]
            }


            const location = e.location.displayName;
            const attendees = e.attendees
                .filter((a: any) => a.emailAddress.name != location)
                .filter((a: any) => a.emailAddress.name != 'Max Großmann')
                .map((a: any) => a.emailAddress.name)

            return {
                title: e.subject,
                start: start,
                end: end,
                location: location,
                attendees: attendees
            };
        });

    }

    async getMSTodaysEvents() {

        const token = await this.msAuthClient.getValidAccessToken();
        const client = await this.msAuthClient.getMSGraphClient(token);

        const now = DateTime.now().setZone(process.env.TZ);
        const startIso = now.toUTC().startOf("day").toISO()!;
        const endIso = now.toUTC().endOf("day").toISO()!;

        const events = await client
            .api("/me/calendarview")
            .query({ startDateTime: startIso, endDateTime: endIso })
            .select("subject,start,end,location,attendees,isAllDay")
            .orderby("start/dateTime")
            .get();

        let eventData = events.value;

        eventData = this.extractMSEventData(eventData)
            .filter((e: any) => e.title != "MIPA")
            .filter((e: any) => e.title != "Laufband")
            .filter((e: any) => e.title != "Zeiten buchen")

        return eventData;
    }

    async getGoogleEvents() {
        const calendar = google.calendar({ version: 'v3', auth: this.googleAuthClient.oauth2Client });

        const date = new Date();
        date.setUTCHours(0, 0, 0, 0);

        const end = new Date(date);
        end.setUTCDate(end.getUTCDate() + 1);


        let events = (await calendar.events.list({
            calendarId: 'primary',
            timeMin: date.toISOString(),
            timeMax: end.toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime'
        })).data.items!!

        events = this.extractGoogleEventData(events);
        return events;
    }

}