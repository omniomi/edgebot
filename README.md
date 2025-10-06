# edgebot
Discord.JS Bot for Displaying DayZ Server Information on The Edge (survivalontheedge.com)

## Configuring the Bot

### Inline Config

Edit the CONFIG variable at the top of the script: 

```JavaScript
const CONFIG = {
    token: process.env.EDGE_BOT_TOKEN,  // DO NOT EDIT
    channelId: process.env.EDGE_BOT_CHANNEL_ID, // DO NOT EDIT
    updateIntervalMs: 300_000, // 5 minutes in miliseconds
    servers: [
        {
            messageId: null,
            color: 0x0037ff,
            name: "Livonia",
            image: "https://survivalontheedge.com/livonia2.png",
            ip: "135.148.150.224",
            port: 2302,
            queryPort: 27016,
            description: "PVE+PVPZones | Sept12 | Traders | Helis | KeyCards | Bunker",
            lastwipe: "September 12th",
            nextwipe: "October 24th",
            restart: true,
        }
    ],
};
```

Server Properties:

- messageId: Do not change
- color: Message side-rail color
- name: The title at the top of the card
- image: A 4:3 (800x600 best) image at the bottom of the card
- ip: The server IP
- port: Player connection port
- queryPort: Query port
- description: Fallback if the server name cannot be queried
- lastwipe: The last time the server was wiped
- nextwipe: The next scheduled wipe
- restart: Whether or not to display restart information (uses `getNextRestartUnix()` helper function)

### Environment Variables

You will need to define env variables for the bot's token and the channel ID. For example, added to a .bashrc file on Linux:

```
export EDGE_BOT_TOKEN="token goes here"
export EDGE_BOT_CHANNEL_ID="channel id goes here"
```

## Running the Bot

Start the bot using `node edgebot.js`
