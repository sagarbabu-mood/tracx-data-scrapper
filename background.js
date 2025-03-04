chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.type === "progress") {
        chrome.runtime.sendMessage(message);
    }
});