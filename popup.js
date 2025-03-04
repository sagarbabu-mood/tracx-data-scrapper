document.addEventListener('DOMContentLoaded', function() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const stats = document.getElementById('stats');
    const currentUrl = document.getElementById('currentUrl');

    // Get and display the current tab's URL
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs || tabs.length === 0) {
            currentUrl.textContent = "Error: No active tab";
            return;
        }
        const tabId = tabs[0].id;
        currentUrl.textContent = `Current URL: ${tabs[0].url}`;

        // Inject content script when popup loads
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("Injection error:", chrome.runtime.lastError.message);
                stats.textContent = "Error: Could not inject script";
            } else {
                console.log("Content script injected into tab:", tabId);
            }
        });
    });

    startBtn.addEventListener('click', function() {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (!tabs || tabs.length === 0) return;
            const tabId = tabs[0].id;
            chrome.tabs.sendMessage(tabId, { type: "start" }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error("Error:", chrome.runtime.lastError.message);
                    stats.textContent = "Error: Content script not responding";
                } else {
                    console.log("Start command sent");
                    stats.textContent = "Scraping started...";
                }
            });
        });
    });

    stopBtn.addEventListener('click', function() {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (!tabs || tabs.length === 0) return;
            const tabId = tabs[0].id;
            chrome.tabs.sendMessage(tabId, { type: "stop" }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error("Error:", chrome.runtime.lastError.message);
                } else {
                    console.log("Stop command sent");
                    stats.textContent = "Scraping stopped";
                }
            });
        });
    });

    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        if (message.type === "progress") {
            stats.textContent = `Rows scraped: ${message.current} / ${message.total || 'unknown'}`;
        }
    });
});