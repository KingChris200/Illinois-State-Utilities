const { EmbedBuilder } = require("discord.js");
const util = require("node:util");


const OWNER_ID = "1065784980564881418";

module.exports = {
    name: "eval",
    aliases: ["e"],
    description: "Evaluate JavaScript code.",

    async execute(client, message, args) {

        // Owner only
        if (message.author.id !== OWNER_ID) {
            return message.reply("❌ You are not allowed to use this command.");
        }

        const code = args.join(" ");

        if (!code) {
            return message.reply("❌ Please provide code to evaluate.");
        }

        try {
            let result = await eval(code);

            if (typeof result !== "string") {
                result = util.inspect(result, {
                    depth: 1,
                    maxArrayLength: 20,
                });
            }

            const embed = new EmbedBuilder()
                .setColor("Green")
                .setTitle("✅ Evaluation Successful")
                .addFields(
                    { name: "Worked", value: "`true`", inline: true },
                    { name: "Output", value: "```js\n" + result.slice(0, 1000) + "\n```" }
                )
                .setTimestamp();

            message.reply({ embeds: [embed] });

        } catch (err) {

            const embed = new EmbedBuilder()
                .setColor("Red")
                .setTitle("❌ Evaluation Failed")
                .addFields(
                    { name: "Worked", value: "`false`", inline: true },
                    { name: "Reason", value: "```js\n" + err.toString().slice(0, 1000) + "\n```" }
                )
                .setTimestamp();

            message.reply({ embeds: [embed] });
        }
    },
};
