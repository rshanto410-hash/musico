'use strict';

const { EmbedBuilder } = require('discord.js');
const { brand } = require('../config');

function base() {
  return new EmbedBuilder()
    .setColor(brand.colors.purple)
    .setFooter({ text: `${brand.name} • ${brand.tagline}` });
}

function info(title, description) {
  return base().setTitle(title).setDescription(description);
}

function success(description) {
  return base().setTitle('✅ Done').setDescription(description);
}

function error(description) {
  return base().setTitle('⚠️ Something went wrong').setDescription(description);
}

module.exports = { base, info, success, error };
