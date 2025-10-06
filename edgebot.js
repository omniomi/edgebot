// edgebot.js
// Requires: discord.js v14, gamedig
// ENV VARS: EDGE_BOT_TOKEN, EDGE_BOT_CHANNEL_ID

const Gamedig = require("gamedig");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

// -----------------------------
// Configuration
// -----------------------------
const CONFIG = {
    token: process.env.EDGE_BOT_TOKEN,
    channelId: process.env.EDGE_BOT_CHANNEL_ID,
    updateIntervalMs: 300_000, // 5 minutes
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
        },
        {
            messageId: null,
            color: 0x880808,
            name: "Deathmatch Arena",
            image: "https://survivalontheedge.com/deathmatch2.png",
            ip: "135.148.150.113",
            port: 2402,
            queryPort: 2403,
            description: "Deathmatch | Upgraded Gear | Progression",
            lastwipe: null,
            nextwipe: null,
            restart: false,
        },
    ],
};

// Basic runtime validation
function assertConfig() {
    if (!CONFIG.token) throw new Error("Missing EDGE_BOT_TOKEN env var.");
    if (!CONFIG.channelId) throw new Error("Missing EDGE_BOT_CHANNEL_ID env var.");
    if (!Array.isArray(CONFIG.servers) || CONFIG.servers.length === 0) {
        throw new Error("No servers configured.");
    }
}

// -----------------------------
// Helpers
// -----------------------------
async function queryDayZServer(host, port) {
    try {
        const info = await Gamedig.GameDig.query({
            type: "dayz",
            host,
            port,
        });

        const players = Number.isFinite(info.numplayers) ? info.numplayers : 0;
        const name = (info.name) ? info.name : null;

        return { players, name };
    } catch (err) {
        console.error(`[queryDayZServer] ${host}:${port} failed ->`, err?.message || err);
        // Return a safe fallback so the embed still renders
        return { players: 0, name: null };
    }
}

/**
 * Returns the UNIX timestamp (seconds) for the next scheduled restart
 * given a list of 24h restart hours (local server time).
 */
function getNextRestartUnix(restartHours = [1, 4, 7, 10, 13, 16, 19, 22]) {
    const now = new Date();
    const currentHour = now.getHours();

    let targetHour = restartHours.find((h) => h > currentHour);
    if (targetHour === undefined) targetHour = restartHours[0];

    const restartDate = new Date(now);
    restartDate.setHours(targetHour, 0, 0, 0);

    // If equal/before now, roll to the next day
    if (restartDate <= now) restartDate.setDate(restartDate.getDate() + 1);

    return Math.floor(restartDate.getTime() / 1000);
}

/**
 * Breaks a long string in half at the closest | if >60 chars
 */
function insertLinebreakAtMiddle(str) {
    if (str.length <= 60) return str; // no break needed

    const parts = str.split("|");
    if (parts.length <= 1) return str; // no '|' found

    const middleIndex = Math.floor(parts.length / 2);
    const firstHalf = parts.slice(0, middleIndex).join("|");
    const secondHalf = parts.slice(middleIndex).join("|");

    return `${firstHalf}|\n${secondHalf}`;
}

function buildServerEmbed({
    color,
    name,
    image,
    ip,
    port,
    description,
    lastwipe,
    nextwipe,
    restartEnabled,
    players,
    nextRestartUnix, // optional
}) {
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(name)
        .setDescription(description || "—")
        //.setThumbnail("https://survivalontheedge.com/img/TheEdge_Logo.png")
        .addFields(
            { name: "IP", value: String(ip), inline: true },
            { name: "Port", value: String(port), inline: true },
            { name: "Online", value: String(players), inline: true },
        )
        .setImage(image)
        .setTimestamp(new Date());

    if (restartEnabled && Number.isFinite(nextRestartUnix)) {
        // Discord relative & absolute time formatting
        embed.addFields({
            name: "Next Restart",
            value: `<t:${nextRestartUnix}:R> at <t:${nextRestartUnix}:t>`,
        });
    }

    if (nextwipe) {
        embed.addFields(
            { name: "Last Wipe", value: lastwipe || "—", inline: true },
            { name: "Next Wipe", value: nextwipe || "—", inline: true },
        );
    }

    return embed;
}

// -----------------------------
// Bot Logic
// -----------------------------
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function updateAllServers() {
    const channel = await client.channels.fetch(CONFIG.channelId).catch(() => null);
    if (!channel) {
        console.error("[updateAllServers] Channel not found or inaccessible.");
        return;
    }

    const nextRestartUnix = getNextRestartUnix(); // compute once (shared window)

    // Update all servers concurrently, but keep each server's own messageId
    const tasks = CONFIG.servers.map(async (srv) => {
        const { players, name } = await queryDayZServer(srv.ip, srv.queryPort);

        const embed = buildServerEmbed({
            color: srv.color,
            name: srv.name,
            image: srv.image,
            ip: srv.ip,
            port: srv.port,
            description: (name) ? insertLinebreakAtMiddle(name) : srv.description,
            lastwipe: srv.lastwipe,
            nextwipe: srv.nextwipe,
            restartEnabled: !!srv.restart,
            players,
            nextRestartUnix: srv.restart ? nextRestartUnix : undefined,
        });

        try {
            if (!srv.messageId) {
                const sent = await channel.send({ embeds: [embed] });
                srv.messageId = sent.id;
                return;
            }
            // Edit by known ID
            await channel.messages.edit(srv.messageId, { embeds: [embed] });
        } catch (err) {
            // If edit fails (e.g., deleted), re-send and store new ID
            console.warn(`[updateAllServers] edit failed for "${srv.name}", re-sending.`, err?.message || err);
            const sent = await channel.send({ embeds: [embed] });
            srv.messageId = sent.id;
        }
    });

    await Promise.allSettled(tasks);
}

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
    // Initial kick
    updateAllServers();
    // Schedule updates
    setInterval(updateAllServers, CONFIG.updateIntervalMs);
});

(async () => {
    try {
        assertConfig();
        await client.login(CONFIG.token);
    } catch (err) {
        console.error("[startup] Failed to launch bot:", err?.message || err);
        process.exit(1);
    }
})();