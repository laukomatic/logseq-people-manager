# People Manager for Logseq

A plugin for managing contacts, tracking birthdays, and staying in touch with the people who matter.

![People Manager Screenshot](./screenshots/main-panel.png)

## Features

### Birthday Reminders
- View upcoming birthdays in the next 30 days
- Automatic birthday tasks created on journal pages
- When you complete a birthday task, next year's reminder is automatically created

### Contact Tracking
- Set contact frequency for each person (e.g., "reach out every 14 days")
- See overdue contacts at a glance
- Track last contact date

### Easy Person Management
- Quick "Add Person" form with smart date parsing
- Type birthdays naturally: `15 Apr 1988`, `April 15, 1988`, `1988-04-15`
- Live preview shows parsed date as you type

![Add Person Form](./screenshots/add-person.png)

## Installation

### From Marketplace
1. Open Logseq
2. Go to Plugins (click `...` menu > Plugins)
3. Search for "People Manager"
4. Click Install

### Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/laukom/logseq-people-manager/releases)
2. Unzip the file
3. In Logseq, go to Plugins > Load unpacked plugin
4. Select the unzipped folder

## Usage

### Opening the Panel
- Click the **People** icon in the toolbar
- Or use the slash command: `/People Manager`

### Adding a Person
1. Click "+ Add Person" button
2. Fill in the details:
   - **Name** (required)
   - **Birthday** - type in any common format
   - **Relationship** - family, friend, colleague, etc.
   - **Contact Frequency** - days between check-ins
   - **Email**
3. Click "Save & Close" or "Save & Add Another"

### Birthday Date Formats
The birthday field accepts many formats:
- `15 Apr 1988` or `15 April 1988`
- `April 15, 1988` or `Apr 15 1988`
- `1988-04-15` (ISO format)
- `15/04/1988` or `15-04-1988`

A green preview appears when the date is recognized.

### How Birthday Reminders Work
1. When you add a person with a birthday, a task is created on their next birthday's journal page
2. The task appears as a proper `#Task` block
3. When you mark the birthday task as DONE, the plugin automatically creates next year's reminder

### Clicking a Person
Click any person card to navigate to their page in Logseq.

## Requirements

- **Logseq DB version** (the new database-backed Logseq)
- The `#people` tag should exist in your graph with these properties:
  - `birthday` (Date)
  - `last-contact` (Date)
  - `contact-frequency` (Number)
  - `relationship` (Select)
  - `email` (Text)

## Compatibility

| Platform | Supported |
|----------|-----------|
| Logseq DB (Desktop) | Yes |
| Logseq DB (Web) | Yes |
| Logseq Classic (Markdown) | No |

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

Made by [laukom](https://github.com/laukom)

## Support

- [Report an issue](https://github.com/laukom/logseq-people-manager/issues)
- [Feature requests](https://github.com/laukom/logseq-people-manager/issues/new)
