const urlRegex = /^(https?:\/\/)(www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})(\/[a-zA-Z0-9._~:/?%#[\]@!$&'()*+,;=-]*\/?)?#?$/;

function isValidUrl(url) {
  return urlRegex.test(url);
}

module.exports = { isValidUrl };
