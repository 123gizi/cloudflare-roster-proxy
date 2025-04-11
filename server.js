const http = require('http');
const fs = require('fs');
const url = require('url');

const html_home = fs.readFileSync('./html_home.html', 'utf8');
const html_denied = fs.readFileSync('./html_denied.html', 'utf8');

function getTimeStamps() {
    const now = new Date();
    return {
        syncTime: now.toUTCString(), // Placed inside event DESCRIPTION for user awareness
        formattedNow: now.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[:-]/g, ''), //YYYYMMDDTHHMMSSZ - Placed inside ICS header as required by some calendar services
    };
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let targetUrl = parsedUrl.query.url;
    const updateParams = parsedUrl.query.hideupdate; //Ensure you pass updateParams to commonFilters

    const { syncTime, formattedNow } = getTimeStamps();
    console.log(`${syncTime} - URL: ${targetUrl}`); //Troubleshooting log - can be removed at a later stage

    if (targetUrl) {
        if (targetUrl.startsWith('webcals://airmaestro.cobhamspecialmission.com.au')) {
            targetUrl = 'https://airmaestro.surveillanceaustralia' + targetUrl.slice('webcals://airmaestro.cobhamspecialmission'.length);
        } else if (targetUrl.startsWith('https://airmaestro.cobhamspecialmission.com.au')) {
            targetUrl = 'https://airmaestro.surveillanceaustralia' + targetUrl.slice('https://airmaestro.cobhamspecialmission'.length);
        } else if (targetUrl.startsWith('webcals://')) {
            targetUrl = 'https://' + targetUrl.slice('webcals://'.length);
        }

        const allowed = 'airmaestro.surveillanceaustralia.com.au/api/calendar';
        if (targetUrl.startsWith(allowed, 8)) {
            try {
                const response = await fetch(targetUrl);
                let body = await response.text();

                if (/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:\r\nUID:[\s\S]+?END:VEVENT/g.test(body)) {
                    body = processPathA(body, updateParams, formattedNow);
                } else {
                    body = processPathB(body, updateParams, formattedNow);
                }

                res.writeHead(200, {'Content-Type': 'text/calendar; charset=UTF-8'});
                res.end(body);
            } catch (error) {
                console.error("Error fetching ICS:", error);
                res.writeHead(500, {'Content-Type': 'text/plain'});
                res.end("Internal Server Error");
            }
        } else {
            res.writeHead(403, {'Content-Type': 'text/html; charset=UTF-8'});
            res.end(html_denied);
        }
    } else {
        res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
        res.end(html_home);
    }
});

// Processing for AM Simplified Link
function processPathA(body, updateParams, formattedNow, syncTime) {
    console.log("[Path A] Starting process");
    body = body.replace("VERSION:2.0", `VERSION:2.0\r\nX-WR-CALNAME:Simple Roster\r\nX-WR-CALDESC:Air Maestro - Modified AM Simplified Link for general use\r\nLAST-MODIFIED:${formattedNow}\r\nMETHOD:PUBLISH\r\nREFRESH-INTERVAL:PT1H\r\nX-PUBLISHED-TTL:PT1H`); // Name variance to assist with distinguishing between the 2 paths should both be used within the same calendar application
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:\r\nUID:[\s\S]+?END:VEVENT/g, ""); // Remove events with no titles
    console.log("[Path A] Filters applied");
    body = commonFilters(body, updateParams, syncTime); // Process filters prior to modifying events
    body = modifySimpleEvents(body); // Simple event modifications
    body = modifyAllDayEvents(body); // Process all-day events
    body = finaliseICSContent(body);
    console.log("[Path A] Completed processing");
    return body;
}

// Processing for AM Full Link (Original)
function processPathB(body, updateParams, formattedNow, syncTime) {
    console.log("[Path B] Starting process");
    body = body.replace("VERSION:2.0", `VERSION:2.0\r\nX-WR-CALNAME:Air Maestro\r\nX-WR-CALDESC:Air Maestro - Modified AM Full External Link for general use\r\nLAST-MODIFIED:${formattedNow}\r\nMETHOD:PUBLISH\r\nREFRESH-INTERVAL:PT1H\r\nX-PUBLISHED-TTL:PT1H`); // Name variance to assist with distinguishing between the 2 paths should both be used within the same calendar application
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:ABFS - STANDBY[\s\S]+?END:VEVENT/g, "");
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:ADM - Administration[\s\S]+?END:VEVENT/g, "");
    console.log("[Path B] Filters applied");
    body = commonFilters(body, updateParams, syncTime); // Process filters prior to modifying events
    body = modifyMainEvents(body); // Main event modifications
    body = modifyAllDayEvents(body); // Process all-day events
    body = finaliseICSContent(body);
    console.log("[Path B] Completed processing");
    return body;
}

// Common Processing for either AM Link
function commonFilters(body, updateParams, syncTime) {
    body = body.replace(/BEGIN:VTIMEZONE[\s\S]+?END:VTIMEZONE/g, ""); //Remove default TZ from calendar - not required as each event contains its own TZ

    // Filters to remove duplicate information within AM based on SUMMARY and DESCRIPTION
    const summaryFilters = [
        //"ABFS - STANDBY",
        //"ADM - Administration",
        "CARERS LEAVE",
        ".*SAPL",
        ".*AMSA",
        "STB - Standby",
    ];

    const descriptionFilters = [
        "RDO",
        "LDO",
        "ALV",
        "SICK",
        "MLV",
        "BLV",
        "DFRLV",
        "LSL",
        "LWOP",
        "WCOMP",
        "LVR",
        "DDO",
        "DIL",
        " CAOL - CAO 48",
    ];

    // Simplify event names using "Original Title: New Title" (processed after the filter)
    const eventNames = {
        "RDO - Rostered Day Off": "RDO",
        "DDO - Destination Day Off": "DDO",
        "LDO - Locked-in Day Off": "LDO",
        "ALV - Annual Leave": "Annual Leave",
        "ABFS - STANDBY": "Standby",
        "STANDBY": "Standby",
        "SICK - Sick Leave": "Sick Leave",
        "LR - Leave Requested": "Leave Requested",
        "DIL - Day Off In Lieu": "DIL",
        "CAO 48 LIM": "CAO",
    };

    summaryFilters.forEach(pattern => {
        body = body.replace(new RegExp(`BEGIN:VEVENT([\\s\\S](?!BEGIN:VEVENT))+?SUMMARY:${pattern}[\\s\\S]+?END:VEVENT`, 'g'), "");
    });

    descriptionFilters.forEach(pattern => {
        body = body.replace(new RegExp(`BEGIN:VEVENT([\\s\\S](?!BEGIN:VEVENT))+?DESCRIPTION:${pattern}[\\s\\S]+?END:VEVENT`, 'g'), "");
    });

    //Must be processed after the filters
    for (const [oldName, newName] of Object.entries(eventNames)) {
        body = body.replace(new RegExp(`SUMMARY:${oldName}`, 'g'), `SUMMARY:${newName}`);
    }

    //body = body.replace(/DTSTART:/gms, "DTSTART;TZID=Etc/UTC:") //TZID Missing in recency events. This is processed after the filters to improve efficiency
    //body = body.replace(/DTEND:/gms, "DTEND;TZID=Etc/UTC:")

    if (updateParams != "true") { //hideupdate API Option
      body = body.replace(/DESCRIPTION:/g, `DESCRIPTION:Last Roster Sync: ${syncTime} \\n\\n\r\n `); //Time logged within events for awareness
    }
    //Remove blank lines - Note: CRLF "End of Line" break requirements
    body = body.replace(/(\r\n){2,}/g, "\r\n");
    console.log("Common filters applied");

    return body;
}

// Function for Path B
function modifyMainEvents(body) {
    // Parse events from the calendar body
    console.log("[Path B] Modifying main events");
    const eventRegex = /BEGIN:VEVENT([\s\S]+?)END:VEVENT/g;
    let events = [];
    let match;

    while ((match = eventRegex.exec(body)) !== null) {
        events.push(match[0]);
    }

    // Sort events in chronological order based on DTSTART
    events.sort((a, b) => {
        const startA = parseDTSTART(a);
        const startB = parseDTSTART(b);
        if (startA === null || startB === null) {
            // Skip comparison for malformed events
            return 0;
        }
        return startA.localeCompare(startB);
    });

    // Iterate over events and modify only valid ones
    for (let i = 0; i < events.length; i++) {
        const currentEvent = events[i];
        const previousEvent = i > 0 ? events[i - 1] : null;
        const nextEvent = i < events.length - 1 ? events[i + 1] : null;

        if (currentEvent.includes("Route") && currentEvent.includes("VH-Z")) {
            if (nextEvent && nextEvent.includes("ABF - ABF")) {
                events[i] = modifyDT(currentEvent, nextEvent);
                events.splice(i + 1, 1); // Remove the next event
            }
        } else if (currentEvent.includes("Route") && currentEvent.includes("TRAVEL")) {
            if (previousEvent && (previousEvent.includes("TVL") || previousEvent.includes("TRVD"))) {
                events[i] = modifyDT(currentEvent, previousEvent);
                events.splice(i - 1, 1); // Remove the previous event
                i--; // Adjust index since we removed an event
            }
        }
    }

    // Remove events with null DTSTART
    events = events.filter(event => parseDTSTART(event) !== null);

    // Merge modified event data back into body
    const firstEventIndex = body.indexOf("BEGIN:VEVENT");
    const mergedEvents = events.join("\r\n");

    // Concatenate the content before the first event and merged events
    body = body.slice(0, firstEventIndex) + mergedEvents;

    return body;
}

// Function to adjust manually generated 'all day' events into correctly formated dates inorder to display correctly across time zones
function modifyAllDayEvents(body) {
    const eventRegex = /BEGIN:VEVENT([\s\S]+?)END:VEVENT/g;
    let events = [];
    let match;

    // Extract all events from the body
    while ((match = eventRegex.exec(body)) !== null) {
        events.push(match[0]);
    }

    // Process all-day events and rare events with DTSTART but no TZID
    events = events.map(event => {
        // Handle explicitly marked all-day events
        if (/\bA\s*l\s*l\s*D\s*a\s*y\b[\s\S]*?END:VEVENT/.test(event)) {
            // Remove DTEND line and any trailing blank lines
            event = event.replace(/DTEND;[^:\n\r]+:[^\n\r]+\r?\n?/g, '');

            // Adjust DTSTART line to include only the date and set VALUE=DATE
            event = event.replace(/DTSTART;[^:\n\r]+:([\d]{8})T[\d]{6}/g, 'DTSTART;VALUE=DATE:$1');
        }

        // Handle rare events with `DTSTART` but no TZID
        if (/DTSTART:(\d{8}T\d{6})/.test(event)) {

            // Remove DTEND line
            event = event.replace(/DTEND;?[^:\n\r]*:[^\n\r]+\r?\n/g, '');

            // Adjust DTSTART to include only the date and set VALUE=DATE
            event = event.replace(/DTSTART:(\d{8})T\d{6}/g, 'DTSTART;VALUE=DATE:$1');
        }

        return event.trim(); // Ensure no trailing whitespace or blank lines
    });

    // Merge modified events back into the body
    const firstEventIndex = body.indexOf("BEGIN:VEVENT");
    const mergedEvents = events.join("\r\n");

    // Concatenate the content before the first event and merged events
    body = body.slice(0, firstEventIndex) + mergedEvents;
    console.log("All-Day events modified");

    return body;
}

// Function to parse DTSTART from event to correctly sort the event array
function parseDTSTART(event) {
    const match = /DTSTART(?:;TZID=[^\n\r]+)?:([\d]{8}T[\d]{6})/g.exec(event);
    if (match) {
        return match[1]; // Extract the date-time value
    }
    console.warn('Skipping event due to missing or invalid DTSTART:', event);
    return null; // Return null for invalid or missing DTSTART
}

// Function to modify DTSTART and DTEND with the specified event's start and end time
function modifyDT(event, adjacentEvent) {
    // Extract the DTSTART and DTEND strings from the adjacent event
    const start = extractDTSTART(adjacentEvent);
    const end = extractDTEND(adjacentEvent);
    // Replace DTSTART and DTEND lines in the current event with those from the adjacent event
    let modifiedEvent = event.replace(/DTSTART;TZID=[^\n\r]+:[^\n\r]+/g, `${start}`);
    modifiedEvent = modifiedEvent.replace(/DTEND;TZID=[^\n\r]+:[^\n\r]+/g, `${end}`);
    return modifiedEvent;
}

// Function to extract DTSTART string from event
function extractDTSTART(event) {
    const match = /DTSTART;TZID=[^\n\r]+:[^\n\r]+/g.exec(event);
    if (match) {
        return match[0];
    }
    // If DTSTART is not found, handle appropriately (e.g., throw an error)
    throw new Error('DTSTART not found in event');
}

// Function to extract DTEND string from event
function extractDTEND(event) {
    const match = /DTEND;TZID=[^\n\r]+:[^\n\r]+/g.exec(event);
    if (match) {
        return match[0];
    }
    // If DTEND is not found, handle appropriately (e.g., throw an error)
    throw new Error('DTEND not found in event');
}

// Function for Path A
function modifySimpleEvents(body) {
    // Parse events from the calendar body
    console.log("[Path A] Modifying simple events");
    const eventRegex = /BEGIN:VEVENT([\s\S]+?)END:VEVENT/g;
    let events = [];
    let match;

    while ((match = eventRegex.exec(body)) !== null) {
        events.push(match[0]);
    }

    // Sort events in chronological order based on DTSTART
    events.sort((a, b) => {
        const startA = parseDTSTART(a);
        const startB = parseDTSTART(b);
        if (startA === null || startB === null) {
            // Skip comparison for malformed events
            return 0;
        }
        return startA.localeCompare(startB);
    });

    // Iterate over events and modify only valid ones
    for (let i = 0; i < events.length; i++) {
        const currentEvent = events[i];
        const previousEvent = i > 0 ? events[i - 1] : null;
        const nextEvent = i < events.length - 1 ? events[i + 1] : null;

        if (currentEvent.includes("Route")) {
            if (nextEvent && nextEvent.includes("ABF - ABF")) {
                events[i] = modifyDT(currentEvent, nextEvent);
                events.splice(i + 1, 1); // Remove the next event
            } else if (previousEvent && previousEvent.includes("Travel")) {
                events[i] = modifyDT(currentEvent, previousEvent);
                events[i] = events[i].replace(/SUMMARY:/, "SUMMARY:Travel: "); // Add to the begining of the event title that this is a Travel event for clairty
                events.splice(i - 1, 1); // Remove the previous event
                i--; // Adjust index since we removed an event
            }
        }
    }

    // Remove events with null DTSTART
    events = events.filter(event => parseDTSTART(event) !== null);

    // Merge modified event data back into body
    const firstEventIndex = body.indexOf("BEGIN:VEVENT");
    const mergedEvents = events.join("\r\n");

    // Concatenate the content before the first event and merged events
    body = body.slice(0, firstEventIndex) + mergedEvents;

    return body;
}

// Function to ensure the final ICS is well formed containing the required VCALENDAR ending.
function finaliseICSContent(body) {
    console.log("Ensuring ICS ends with END:VCALENDAR");

    // Reconstruct the final ICS body
    let finalBody = body;

    // Ensure the file ends with END:VCALENDAR
    if (!finalBody.trim().endsWith("END:VCALENDAR")) {
        finalBody += '\r\nEND:VCALENDAR';
    }

    return finalBody;
}

server.listen(5275, () => {
    console.log('Server running on port 5275');
});
