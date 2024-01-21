import html_home from './html_home.html';
import html_denied from './html_denied.html';

export default {
  async fetch(request) {
    const init_default = {
      headers: {
        "content-type": "text/html; charset=UTF-8",
      },
    };
    const init_approved = {
      headers: {
        "content-type": "text/calendar; charset=UTF-8",
        "connection": "close",
      },
      method: "GET",
      cf: { cacheTtl: 5 }
    };
    const init_denied = {
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "status": "403",
      },
    };
    const { searchParams } = new URL(request.url);
    let targetUrl = searchParams.get('url');
    let overlapParams = searchParams.get('overlap'); //Do you want your shift to overlay with the duty rostered?
    let newDate = new Date(Date.now());
    console.log(`${newDate.toDateString()} ${newDate.toTimeString()} - ${targetUrl} - overlap=${overlapParams}`);

    if (targetUrl != null ){
      if (targetUrl.startsWith('webcals://airmaestro.cobhamspecialmission.com.au')) {
        targetUrl = 'https://airmaestro.surveillanceaustralia' + targetUrl.slice('webcals://airmaestro.cobhamspecialmission'.length);
      } else if (targetUrl.startsWith('https://airmaestro.cobhamspecialmission.com.au')) {
        targetUrl = 'https://airmaestro.surveillanceaustralia' + targetUrl.slice('https://airmaestro.cobhamspecialmission'.length);
      } else if (targetUrl.startsWith('webcals://')) {
        targetUrl = 'https://' + targetUrl.slice('webcals://'.length);
      }
      const allowed = 'airmaestro.surveillanceaustralia.com.au';
      let approvedUrl = targetUrl;
      if (approvedUrl.startsWith(allowed, 8)) {
        approvedUrl = targetUrl;
        //Unsure if Headers for fetch do anything
        let response = await fetch(approvedUrl, init_approved);
        //let response = await fetch(approvedUrl);
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
    let reader = readable.getReader();
    let writer = writable.getWriter();
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder('utf-8');

    //let newDate = new Date(Date.now());
    //console.log(`${newDate.toDateString()} ${newDate.toTimeString()}`);

    let body = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      body += decoder.decode(value)
    }

    //Adding a Name to the calendar and a suggested publish limit of no more than 1 hour
    body = body.replace("VERSION:2.0", "VERSION:2.0\nX-WR-CALNAME:Air Maestro\nX-PUBLISHED-TTL:PT1H")

    //Time logged for testing
    //body = body.replaceAll("Custom Fields:", "Custom Fields: Last Checked @ " + newDate)

    //Regex used to replace all TZIDs with Etc/UTC to correct for time abnormalities within AM
    body = body.replace(/(?<=;TZID=).*?(?=:)/gms, "Etc/UTC")

    //Filters to be used to remove some duplication of information inherent in AM
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:STANDBY[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:ADM - Administration[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:CARERS LEAVE[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:.*SAPL[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:.*STBY[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:RDO - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:LDO - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:ALV - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:SICK - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:CAO 48 LIM[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:MLV - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:BLV - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:DFRLV - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:LSL - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:LWOP - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:WCOMP - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:LVR - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:DDO - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:DIL - ABF[\s\S]+?END:VEVENT/g, "")

    //Truncate common event names
    body = body.replace(/SUMMARY:RDO - Rostered Day Off/g, "SUMMARY:RDO")
    body = body.replace(/SUMMARY:DDO - Destination Day Off/g, "SUMMARY:DDO")
    body = body.replace(/SUMMARY:LDO - Locked-in Day Off/g, "SUMMARY:LDO")
    body = body.replace(/SUMMARY:ALV - Annual Leave/g, "SUMMARY:Annual Leave")
    body = body.replace(/SUMMARY:ABFS - STANDBY/g, "SUMMARY:Standby")
    body = body.replace(/SUMMARY:SICK - Sick Leave/g, "SUMMARY:Sick Leave")
    body = body.replace(/SUMMARY:DIL - Day Off In Lieu/g, "SUMMARY:DIL")

    //Remove additional spaces left over after AM removes unauthorised data for user
    body = body.replace(/\\n\\n\\n\\n\\n/gms, "\\n\\n")
    body = body.replace(/&nbsp\\;/gms, " ")

//IF function overlapParams == "false" run JT minimise code
    if (overlapParams == "false") {
      const header = body.split("BEGIN:VEVENT")[0]; //Extract the header (everything before the first "BEGIN:VEVENT")
      const modifiedEvents = []; //Array to store modified events. Used to preserve event order purely for easy before/after text comparison
      const events = body.split("END:VEVENT"); //Split the data by events
      events.pop(); //Remove the last element which is an empty string
      events.forEach((eventData) => {
        //Extract start/end times for later processing
        const dtstartMatch = eventData.match(/DTSTART;TZID=Etc\/UTC:(\d{8}T\d{6})/);
        const dtendMatch = eventData.match(/DTEND;TZID=Etc\/UTC:(\d{8}T\d{6})/);

        if (dtstartMatch && dtendMatch) {
          const dtstart = new Date(dtstartMatch[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z'));
          const dtend = new Date(dtendMatch[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z'));
          let modifiedEventData = eventData;
          //Remove overlapping roster events (keep Travel without flight bookings) - Skip adding these events to modifiedEvents
          if (eventData.includes("DESCRIPTION: ABF - ABF") || eventData.includes("DESCRIPTION: TVL - Travel")) {
            return;
          }
          //Modify past and future flight events to start 2 hours earlier and finish 30 minutes later - reflect general sign-on times
          if (eventData.includes("DESCRIPTION:ABF - Planned") || eventData.includes("DESCRIPTION:ABF - Partial") || eventData.includes("DESCRIPTION:ABF - Complete")) {
            dtstart.setHours(dtstart.getHours() - 2);
            dtend.setMinutes(dtend.getMinutes() + 30);
            const modifiedDtstart = dtstart.toISOString().replace(/[:\-]|\.\d{3}Z/g, '');
            const modifiedDtend = dtend.toISOString().replace(/[:\-]|\.\d{3}Z/g, '');
            modifiedEventData = modifiedEventData.replace(dtstartMatch[1], modifiedDtstart).replace(dtendMatch[1], modifiedDtend);
            modifiedEvents.push(modifiedEventData + "END:VEVENT");
          }
          //Change events longer than 23 hours to be All Day events based on end date
          else if ((dtend - dtstart) > 23 * 60 * 60 * 1000) {
            const allDayDate = dtend.toISOString().split('T')[0].replace(/-/g, '');
            modifiedEventData = modifiedEventData.replace(/DTSTART;TZID=Etc\/UTC:[^;\n]*/, `DTSTART;VALUE=DATE:${allDayDate}`)
                .replace(/DTEND;TZID=Etc\/UTC:[^;\n]*/, '');
            modifiedEvents.push(modifiedEventData + "END:VEVENT");
          }
          //Preserve all other events
          else {
            modifiedEvents.push(modifiedEventData + "END:VEVENT");
          }
        }
      });
      //Combine the header, footer, and modified event data
      const modifiedFileContent = header + modifiedEvents.join("") + "\nEND:VCALENDAR";
      //const modifiedFileContent = modifiedEvents.join("") + "\nEND:VCALENDAR";
      //const finalFileContent = modifiedFileContent.replace(/^\s*\n/gm, "");
      body = modifiedFileContent
    }

    await writer.write(encoder.encode(body))
    await writer.close()

  }
  },
};
