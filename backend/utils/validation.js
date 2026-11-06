const validator = require("validator");

const isValidUrl = (value) => validator.isURL(value);

module.exports = { isValidUrl };
