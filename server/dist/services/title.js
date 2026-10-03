"use strict";

function selectTrackTitle(tagTitle, filenameTitle) {
    if (typeof tagTitle !== "string") return filenameTitle;
    const title = tagTitle.trim();
    if (!title || /[\u0000-\u001f\u007f\ufffd]/u.test(title)) return filenameTitle;
    if (title.includes("+++") || title.includes("&&&")) return filenameTitle;
    const plusCount = (title.match(/\+/g) || []).length;
    const questionCount = (title.match(/\?/g) || []).length;
    if (plusCount >= 3 || plusCount + questionCount >= 4) return filenameTitle;
    return title;
}

module.exports = { selectTrackTitle };
