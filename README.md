# Roster Access: Karlendar

## Overview
The **Karlendar** project simplifies access to your Air Maestro roster through a personalized calendar link that integrates seamlessly with popular calendar services like Google Calendar, Microsoft Outlook, and Apple Calendar.

This tool ensures your Air Maestro schedule is consistently updated while applying specific adjustments to make your roster more readable and user-friendly. It operates as a **Cloudflare Worker** to fetch, modify, and serve your Air Maestro calendar data.

---

## Key Features
1. **Dynamic Time Zone Adjustment**:
   - Automatically corrects time zones in events based on Air Maestro outputs.
2. **Event Deduplication**:
   - Removes duplicate entries for leave, day-offs, standby, and admin events.
3. **All-Day Event Formatting**:
   - Adjusts all-day events like "Rostered Day Off" (RDO) to proper calendar formats.
4. **Simplified Event Titles**:
   - Shortens event names for easier readability (e.g., "RDO - Rostered Day Off" becomes "RDO").
5. **Tasking and Duty Merging**:
   - Combines overlapping events like tasking and duty shifts for a cleaner display.
6. **Sync Awareness**:
   - Adds the last roster sync time to event descriptions for user awareness.
7. **Multiple Calendar Services**:
   - Generates a personalized calendar URL that can be added to:
     - Google Calendar
     - Microsoft Outlook (personal and corporate)
     - Apple Calendar

---

## How It Works
1. **Calendar Link**:
   - Generate a calendar link from Air Maestro by signing into Okta and copying the external calendar link.
2. **Modify and Personalize**:
   - Paste the Air Maestro link into the provided field, and Karlendar will create a new subscription URL.
   - The subscription URL processes your Air Maestro events, applying adjustments before displaying them in your calendar.
3. **Cloudflare Worker**:
   - The backend logic runs on a Cloudflare Worker to ensure low latency and high availability.
   - Events are filtered, modified, and served securely to your calendar application.

---

## Setup Instructions
### Step 1: Generate Air Maestro Calendar Link
1. Log into Air Maestro via Okta.
2. Navigate to the **Schedule** page.
3. Generate and copy your personal calendar link.

### Step 2: Use Karlendar
1. Paste the copied calendar link into the input field on the Karlendar homepage.
2. Click **Generate Modified Link**.
3. Use the generated link in your calendar application:
   - **Google Calendar**: Add via [this link](https://calendar.google.com/calendar/u/0/r/settings/addbyurl).
   - **Microsoft Outlook**: Add via [Outlook Personal](https://outlook.live.com/calendar/addcalendar) or [Corporate M365](https://outlook.office.com/calendar/addcalendar).
   - **Apple Calendar**: Use the "Add Subscription Calendar" option.

---

## Code Explanation
### Cloudflare Worker (`worker.js`)
1. **Main Functions**:
   - `processPathA`: Handles simplified Air Maestro links by removing blank events and applying minor adjustments.
   - `processPathB`: Handles full Air Maestro links, including additional filters for redundant or unnecessary events.
   - `modifyAllDayEvents`: Formats all-day events correctly by removing redundant `DTEND` fields and adjusting `DTSTART` values.
   - `commonFilters`: Centralized filters to remove duplicate and irrelevant data.

2. **Caching**:
   - The Worker caches responses for 30 minutes unless explicitly overridden.

3. **Error Handling**:
   - Redirects users to an informative landing page for unsupported links or errors.

### HTML Landing Page (`html_home.html`)
- Provides a user-friendly interface to paste the Air Maestro link and generate a modified subscription URL.
- Includes step-by-step instructions for Google Calendar, Microsoft Outlook, and Apple Calendar.
- Offers troubleshooting FAQs and advanced API options.

---

## FAQs
1. **How often does the calendar update?**
   - Sync frequency depends on your calendar service (typically every 4–48 hours).

2. **Will my personal data be stored?**
   - No calendar event data is stored within this project. All processing is done in transit.

3. **What if my events aren't updating?**
   - Ensure your subscription URL is correct. Updates may take up to 48 hours to appear.

4. **Can I customize the output?**
   - API parameters (e.g., `&hideupdate=true`) allow basic customization. More options may be added based on user feedback.

---

## Disclaimer
This tool is intended for convenience only. Air Maestro remains the authoritative source for schedule accuracy. Always confirm shifts and duties with official communication channels.

