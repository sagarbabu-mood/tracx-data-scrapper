let continueScraping = false;

console.log("Content script loaded");
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log("Message received:", message);
    if (message.type === "start") {
        continueScraping = true;
        scrapeGridTableAndDownloadCSV();
        sendResponse({ status: "started" });
    } else if (message.type === "stop") {
        continueScraping = false;
        sendResponse({ status: "stopped" });
    }
});

async function scrapeGridTableAndDownloadCSV() {
    const fundingElement = document.querySelector('.txn--text-color-bunting.txn--border-right.txn--margin-right-16.txn--padding-right-16');
    if (!fundingElement) {
        console.error("Funding rounds element not found!");
        return;
    }
    const fundingText = fundingElement.innerText;
    const totalRowsMatch = fundingText.match(/(\d+\.?\d*[KMB]?)/i);
    let totalRows = 0;
    if (totalRowsMatch) {
        const numStr = totalRowsMatch[0].toUpperCase();
        totalRows = parseFloat(numStr) * (numStr.includes('K') ? 1000 : numStr.includes('M') ? 1000000 : numStr.includes('B') ? 1000000000 : 1);
    }
    console.log(`Total rows to scrape: ${totalRows}`);

    const gridTableColumns = document.querySelector('.comp--gridtable__columns');
    if (!gridTableColumns) {
        console.error("Columns div not found!");
        return;
    }
    const columnsInnerDiv1 = gridTableColumns.querySelector('div');
    const columnDivs = Array.from(columnsInnerDiv1.querySelectorAll(':scope > div'));
    const columnNames = columnDivs.map(div => div.innerText.trim().replace(/,/g, ''));
    columnNames.push("Tracxn URL");
    console.log(`Found ${columnNames.length} columns:`, columnNames);

    const scrapedData = [];
    let lastRowIndex = -1;

    function scrapeVisibleRows() {
        const rows = Array.from(document.querySelectorAll('[data-walk-through-id^="gridtable-row-"]'));
        rows.forEach(row => {
            const rowIndex = parseInt(row.getAttribute('data-walk-through-id').split('-').pop());
            if (rowIndex > lastRowIndex) {
                const cells = Array.from(row.querySelectorAll(':scope > div'));
                const rowData = cells.map(cell => cell.innerText.trim().replace(/,/g, ''));
                const linkElement = row.querySelector('a.txn--full-width.txn--display-block.txn--cursor-pointer');
                const tracxnURL = linkElement ? `https://platform.tracxn.com${linkElement.getAttribute('href')}` : '';
                const adjustedRowData = Array(columnNames.length - 1).fill('');
                rowData.forEach((cell, idx) => {
                    if (idx < adjustedRowData.length) adjustedRowData[idx] = cell;
                });
                adjustedRowData.push(tracxnURL);
                scrapedData[rowIndex] = adjustedRowData;
                lastRowIndex = rowIndex;
            }
        });
        const currentCount = scrapedData.filter(row => row).length;
        console.log(`Scraped up to row ${lastRowIndex}, total: ${currentCount}`);
        chrome.runtime.sendMessage({ type: "progress", current: currentCount, total: totalRows });
    }

    const scrollElement = document.querySelector('.comp--gridtable-v2');
    if (!scrollElement) {
        console.error("Scroll element not found!");
        return;
    }

    async function scrollAndScrape() {
        while (continueScraping && scrapedData.filter(row => row).length < totalRows) {
            scrapeVisibleRows();
            const currentRowCount = scrapedData.filter(row => row).length;
            if (currentRowCount >= totalRows) break;
            await new Promise(resolve => setTimeout(resolve, 2000));
            scrollElement.scrollTop = scrollElement.scrollHeight;
            console.log(`Scrolled to ${scrollElement.scrollTop}/${scrollElement.scrollHeight}, rows: ${currentRowCount}`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            scrapeVisibleRows();
            if (scrapedData.filter(row => row).length === currentRowCount) {
                console.warn("No new rows loaded, possibly end of content.");
                break;
            }
        }
        if (!continueScraping) console.log("Scraping stopped by user.");
    }

    await scrollAndScrape();
    console.log(`Final scraped rows: ${scrapedData.filter(row => row).length}`);
    
    const finalCount = scrapedData.filter(row => row).length;
    const filename = `tracxn_data_${timestamp}_with_${finalCount}_companies.csv`;

    let csvContent = "data:text/csv;charset=utf-8,";
    const escapedColumnNames = columnNames.map(name => /[,"#\n]/.test(name) ? `"${name.replace(/"/g, '""')}"` : name);
    csvContent += escapedColumnNames.join(",") + "\n";
    const validRows = scrapedData.filter(row => row);
    csvContent += validRows.map(row => {
        const escapedRow = row.map(cell => /[,"#\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
        return escapedRow.join(",");
    }).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename); // Updated to dynamic filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log("CSV downloaded successfully!");
}
