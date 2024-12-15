import html_home from './html_home.html';
import html_denied from './html_denied.html';

export default {
  async fetch(request) {
    const init_default = {
      headers: {
        "content-type": "text/html; charset=UTF-8",
      },
    };

    const { searchParams } = new URL(request.url);
    let targetUrl = searchParams.get('url');
    const overlapParams = searchParams.get('overlap'); //By default, your duty shift will be combined with the tasking rostered
    const updateParams = searchParams.get('hideupdate'); //Can be used to hide update time from DESCRIPTION if required
    const refreshCache = searchParams.get('cache') === 'false';

    //Cookies required as of AM 3.7.4 update
    const init_approved = {
      method: 'GET',
      headers: {
        'content-type': 'text/calendar; charset=UTF-8',
      },
      cf: { cacheTtl: refreshCache ? 0 : 1800 }, //Cache for 25 minutes (1800 seconds) unless refreshCache is true. This is to reduce the number of requests sent to the Origin Server unless it explicitly instructs 'Cache-Control: no-cache or max-age=0'
    };

    const init_denied = {
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "status": "403",
      },
    };

    const newDate = new Date(Date.now());
    const syncTime = newDate.toUTCString();
    const formattedNow = newDate.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[:-]/g, ''); //YYYYMMDDTHHMMSSZ
    //console.log(`${newDate.toDateString()} ${newDate.toTimeString()} - ${targetUrl}`); //Troubleshooting log, this can be removed at a later stage
    console.log(`${syncTime} - URL: ${targetUrl}`); //Troubleshooting log, this can be removed at a later stage

    //Only allowed URLs may be used with this worker. Allowance made for domain change in 2023 for the roster service.
    if (targetUrl != null ){
      if (targetUrl.startsWith('webcals://airmaestro.cobhamspecialmission.com.au')) {
        targetUrl = 'https://airmaestro.surveillanceaustralia' + targetUrl.slice('webcals://airmaestro.cobhamspecialmission'.length);
      } else if (targetUrl.startsWith('https://airmaestro.cobhamspecialmission.com.au')) {
        targetUrl = 'https://airmaestro.surveillanceaustralia' + targetUrl.slice('https://airmaestro.cobhamspecialmission'.length);
      } else if (targetUrl.startsWith('webcals://')) {
        targetUrl = 'https://' + targetUrl.slice('webcals://'.length);
      }
      const allowed = 'airmaestro.surveillanceaustralia.com.au/api/calendar';
      let approvedUrl = targetUrl;
      if (approvedUrl.startsWith(allowed, 8)) {
        approvedUrl = targetUrl;
        let response = await fetch(approvedUrl, init_approved);
        let { readable, writable } = new TransformStream();
        streamBody(response.body, writable);

        return new Response(readable, response);

      } else {
        return new Response(html_denied, init_denied);
        }
    } else {
      return new Response(html_home, init_default);
    }

  async function streamBody(readable, writable) {
      const reader = readable.getReader();
      const writer = writable.getWriter();
      const decoder = new TextDecoder('utf-8');
      const encoder = new TextEncoder('utf-8');

      try {
          let body = '';
          while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              body += decoder.decode(value);
          }

    //Adding a Name to the calendar and a suggested publish limit of no more than once per hour
    body = body.replace("VERSION:2.0", `VERSION:2.0\r\nX-WR-CALNAME:Air Maestro\r\nX-WR-CALDESC:Air Maestro - Modified for regular use\r\nLAST-MODIFIED:${formattedNow}\r\nMETHOD:PUBLISH\r\nREFRESH-INTERVAL:PT1H\r\nX-PUBLISHED-TTL:PT1H`)

    body = body.replace(/BEGIN:VTIMEZONE[\s\S]+?END:VTIMEZONE/g, "") //Remove default TZ from calendar - not required as each event contains its own TZ
    //body = body.replace(/BEGIN:VTIMEZONE[\s\S]+?END:VTIMEZONE/g, "BEGIN:VTIMEZONE\r\nTZID:UTC\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000Z\r\nTZOFFSETFROM:+0000\r\nTZOFFSETTO:+0000\r\nEND:STANDARD\r\nEND:VTIMEZONE") //Replace default TZ generated with only UTC - not required as each event contains its own TZ

    // Filters to remove duplicate information within AM based on SUMMARY and DESCRIPTION
    const summaryFilters = [
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
        "STANDBY - Planned",
        "ADMIN - Planned",
    ];

    // Simplify event names using "Original Title: New Title" (processed after the filter)
    const eventNames = {
        "RDO - Rostered Day Off": "RDO",
        "DDO - Destination Day Off": "DDO",
        "LDO - Locked-in Day Off": "LDO",
        "ALV - Annual Leave": "Annual Leave",
        "ABFS - STANDBY": "Standby",
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

    body = body.replace(/DTSTART:/gms, "DTSTART;TZID=Etc/UTC:") //TZID Missing in recency events. This is processed after the filters to improve efficiency

    //Used to combine some events and mark All Day events correctly. This is set as DEFAULT and presents events differently to the standard experience of AM.
    if (overlapParams !== "true") { //overlap API Option
        let events = [];
        // Parse events from the calendar body
        const eventRegex = /BEGIN:VEVENT([\s\S]+?)END:VEVENT/g;
        let match;
        while ((match = eventRegex.exec(body)) !== null) {
            events.push(match[0]);
        }

        // Sort events in chronological order based on DTSTART
        events.sort((a, b) => {
            const startA = parseDTSTART(a);
            const startB = parseDTSTART(b);
            return startA.localeCompare(startB);
        });

        // Iterate over events and modify DTSTART and DTEND based on adjacent events
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
            } else if (/\bA\s*l\s*l\s*D\s*a\s*y\b[\s\S]*?END:VEVENT/.test(currentEvent)) {
                // Modify All Day event to remove DTEND and adjust DTSTART to correctly display in calendar clients
                events[i] = modifyAllDayEvent(currentEvent);
            }
        }

        // Merge modified event data back into body
        // Find the index of the first "BEGIN:VEVENT" marker
        const firstEventIndex = body.indexOf("BEGIN:VEVENT");
        let mergedEvents = events.join("\r\n");
        // Concatenate the content before the first event, merged events, and the "END:VCALENDAR" marker
        body = body.slice(0, firstEventIndex) + mergedEvents + '\r\nEND:VCALENDAR';

    }

    // Function to modify All Day event to remove DTEND and adjust DTSTART
    function modifyAllDayEvent(event) {
        // Remove DTEND line
        let modifiedEvent = event.replace(/DTEND;[^:\n\r]+:[^\n\r]+/g, '');

        // Adjust DTSTART line to include only the date and set VALUE=DATE
        modifiedEvent = modifiedEvent.replace(/DTSTART;[^:\n\r]+:([\d]{8})T[\d]{6}/g, 'DTSTART;VALUE=DATE:$1');

        return modifiedEvent;
    }

    // Function to parse DTSTART from event to correctly sort the event array
    function parseDTSTART(event) {
        const match = /DTSTART;TZID=[^\n\r]+:(\d{8}T\d{6})/g.exec(event);
        if (match) {
            return match[1]; // Extract only the date and time numbers
        }
        // If DTSTART is not found, handle appropriately (e.g., throw an error)
        throw new Error('DTSTART not found in event');
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

    // Function to extract DESCRIPTION field
    function extractDescription(event) {
        const match = /DESCRIPTION:(.+)/s.exec(event);
        return match ? match[1].trim() : "";
    }

    // Helper function to update DESCRIPTION field
    function updateDescription(event, newDescription) {
        return event.replace(/DESCRIPTION:.+/, `DESCRIPTION:${newDescription}`);
    }

    //Remove events with blank SUMMARY
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:\r\nUID:[\s\S]+?END:VEVENT/g, "");


    if (updateParams != "true") { //hideupdate API Option
      body = body.replace(/DESCRIPTION:/g, `DESCRIPTION:Last Roster Sync: ${syncTime} \\n\\n\r\n `); //Time logged within events for awareness
    }
    //Remove blank lines - Note: CRLF "End of Line" break requirements
    body = body.replace(/(\r\n){2,}/g, "\r\n");

        await writer.write(encoder.encode(body));
    } catch (error) {
        console.error("Error processing stream:", error);
    } finally {
        // Close the writer to indicate that we're done
        await writer.close();
      }
    }
    },
  };
